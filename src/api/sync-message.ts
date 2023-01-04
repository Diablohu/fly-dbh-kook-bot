import axios from 'axios';

import type { MessageSource } from '../../types';

import getDefaultHeaders from '../headers';
import upload from '../upload';
import { messageMap } from '../main';
import { getSourceLogo } from '../source-logos';
import { newsChannelID } from '../../app.config';

// ============================================================================

// const queue: ((...args: unknown[]) => unknown)[] = [];
// async function queueRun(func?: (...args: unknown[]) => unknown): Promise<void> {
//     if (typeof func === 'function') {
//         queue.push(func);
//     }

//     const first = queue.shift();

//     try {
//         if (typeof first === 'function') await first();
//     } catch (e) {
//         console.trace(e);
//     }

//     if (queue.length > 0) await queueRun();
// }

type Module =
    | {
          type:
              | 'section'
              | 'context'
              | 'kmarkdown'
              | 'plain-text'
              | 'image'
              | 'image-group'
              | 'container';
          src?: string;
          content?: string;
          elements?: Module[];
          text?: Module;
          size?: 'sm' | 'md' | 'lg';
      }
    | undefined;
type Message = {
    type: 'card';
    theme?: 'primary' | 'warning' | 'danger' | 'info' | 'none' | 'secondary';
    color?: string;
    size?: 'sm' | 'md' | 'lg';
    modules: Module[];
};

// ============================================================================

export async function parseDiscordMessage() {
    //
}

function transformMarkdown(input: string): string {
    return input.replace(
        /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/g,
        `[$1]($1)`
    );
}

export async function syncMessage({
    msgId,
    channelId,
    // userid,
    userName,
    userAvatar,
    // userAvatarId,
    createAt,
    body,
    attachments,
    embeds,
    source,
}: {
    msgId: string;
    channelId: string;
    userid: string;
    userName: string;
    userAvatar: string;
    createAt: number;
    body: string;
    attachments: {
        url: string;
        type: string;
    }[];
    embeds: {
        type: 'rich' | 'video';
        url?: string;
        timestamp?: string;
        description?: string;
        color?: number;
        author?: {
            name?: string;
            icon_url?: string;
            url?: string;
            proxy_icon_url?: string;
        };
        image?: {
            width?: number;
            height?: number;
            url?: string;
            proxy_url?: string;
        };
        footer?: {
            text?: string;
            proxy_icon_url?: string;
            icon_url?: string;
        };
        fields?: {
            value?: string;
            name?: string;
            inline?: boolean;
        }[];
    }[];
    source?: MessageSource;
}) {
    const avatar = !userAvatar ? undefined : await upload(userAvatar);

    const content: Message[] = [
        {
            type: 'card',
            theme: 'secondary',
            size: 'lg',
            modules: [
                {
                    type: 'context',
                    elements: [
                        !!avatar
                            ? ({
                                  type: 'image',
                                  src: avatar,
                              } as Module)
                            : undefined,
                        { type: 'plain-text', content: userName } as Module,
                        // {
                        //     type: 'plain-text',
                        //     content: ` ${createAt}`,
                        // },
                    ].filter((v) => !!v),
                },
                {
                    type: 'section',
                    text: {
                        type: 'kmarkdown',
                        content: transformMarkdown(body),
                        //
                    },
                },
            ],
        },
    ];

    if (Array.isArray(attachments)) {
        const filtered = attachments.filter(({ type }) =>
            /^image\//.test(type)
        );
        let index = 0;
        for (const { url } of filtered) {
            // if (/^image\//.test(type)) {
            filtered[index].url = await upload(url);
            // }
            index++;
        }

        if (filtered.length === 1) {
            content[0].modules.push({
                type: 'container',
                elements: [
                    {
                        type: 'image',
                        src: filtered[0].url,
                    },
                ],
            });
        } else if (filtered.length > 1) {
            content[0].modules.push({
                type: 'image-group',
                elements: filtered.map(({ type, url }) => ({
                    type: 'image',
                    src: url,
                })),
            });
        }
    }

    // 处理 source
    {
        let sourceLogo, sourceTitle;
        switch (source) {
            case 'discord': {
                sourceLogo = await getSourceLogo(source);
                sourceTitle = 'Discrod';
                break;
            }
            default: {
            }
        }
        content[0].modules.push({
            type: 'context',
            elements: [
                !sourceLogo
                    ? undefined
                    : ({
                          type: 'image',
                          src: sourceLogo,
                      } as Module),
                {
                    type: 'plain-text',
                    content: [
                        sourceTitle,
                        new Intl.DateTimeFormat('zh-CN', {
                            dateStyle: 'long',
                            timeStyle: 'short',
                            timeZone: 'Asia/Shanghai',
                        }).format(new Date(createAt)),
                    ]
                        .filter((v) => !!v)
                        .join(' · '),
                } as Module,
            ].filter((v) => !!v),
        });
    }

    if (Array.isArray(embeds) && embeds.length > 0) {
        // console.log(embeds);
        const thisContent: Message = {
            type: 'card',
            theme: 'secondary',
            size: 'lg',
            modules: [],
        };
        let index = 0;
        let imageModule: Module;
        async function addImage(image: {
            width?: number;
            height?: number;
            url?: string;
            proxy_url?: string;
        }) {
            if (!imageModule) {
                imageModule = {
                    type: 'container',
                    elements: [
                        {
                            type: 'image',
                            src: await upload(image.url as string),
                        },
                    ],
                };
                thisContent.modules.push(imageModule);
            } else {
                imageModule.type = 'image-group';
                imageModule.elements?.push({
                    type: 'image',
                    src: await upload(image.url as string),
                });
            }
        }
        for (const {
            type,
            color,
            author,
            description,
            image,
            footer,
            timestamp,
        } of embeds) {
            if (typeof color === 'number') {
                delete thisContent['theme'];
                thisContent.color =
                    '#' + (color + Math.pow(16, 6)).toString(16).substr(-6);
            }
            switch (type) {
                case 'rich': {
                    if (
                        thisContent.modules.length > 1 &&
                        index > 0 &&
                        !!image &&
                        !description
                    ) {
                        await addImage(image);
                    } else {
                        if (!!author) {
                            thisContent.modules.push({
                                type: 'context',
                                elements: [
                                    !!author.icon_url
                                        ? {
                                              type: 'image',
                                              //   size: 'sm',
                                              src: await upload(
                                                  author.icon_url
                                              ),
                                          }
                                        : undefined,
                                    !!author.url
                                        ? {
                                              type: 'kmarkdown',
                                              content: `[${author.name}](${author.url})`,
                                          }
                                        : {
                                              type: 'plain-text',
                                              content: author.name,
                                          },
                                ].filter((v) => !!v) as Module[],
                            });
                        }
                        if (!!description)
                            thisContent.modules.push({
                                type: 'section',
                                text: {
                                    type: 'kmarkdown',
                                    content: transformMarkdown(description),
                                    //
                                },
                            });
                        if (!!image) await addImage(image);
                        if (!!footer) {
                            thisContent.modules.push({
                                type: 'context',
                                elements: [
                                    {
                                        type: 'image',
                                        src: await getSourceLogo(
                                            footer.text as MessageSource,
                                            footer.icon_url
                                        ),
                                    },
                                    !!timestamp
                                        ? {
                                              type: 'plain-text',
                                              content: [
                                                  footer.text,
                                                  new Intl.DateTimeFormat(
                                                      'zh-CN',
                                                      {
                                                          dateStyle: 'long',
                                                          timeStyle: 'short',
                                                          timeZone:
                                                              'Asia/Shanghai',
                                                      }
                                                  ).format(new Date(timestamp)),
                                              ]
                                                  .filter((v) => !!v)
                                                  .join(' · '),
                                          }
                                        : undefined,
                                ].filter((v) => !!v) as Module[],
                            });
                        }
                    }
                    break;
                }
                default: {
                }
            }
            index++;
        }

        if (thisContent.modules.length > 0) {
            content.push(thisContent);
        }
    }
    // console.log(content);
    // console.log({ userid, userName, userAvatar }, content);

    const url =
        'https://www.kookapp.cn/api/v/message/' +
        (messageMap.has(msgId) ? 'update' : 'create');
    const postData: Record<string, unknown> = {
        type: 10,
        target_id: channelId || newsChannelID,
        // content: (
        //     ctx.request.body as {
        //         content?: string;
        //     }
        // )?.content,
        content: JSON.stringify(content),
        nonce: `FLY-DBH-KOOK-BOT @ ${Date.now()}`,
    };

    if (messageMap.has(msgId)) {
        postData.msg_id = messageMap.get(msgId);
    }

    const res = await axios.post(url, postData, {
        headers: {
            ...getDefaultHeaders(),
        },
    });

    console.log(res.data, res.data.data.msg_id);
    messageMap.set(msgId, res.data.data.msg_id);

    return res;
}
