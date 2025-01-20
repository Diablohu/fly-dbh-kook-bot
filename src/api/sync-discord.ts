import type { Message, Embed } from 'discord.js';

import type {
    MessageSource,
    ModuleType,
    CardMessageType,
    MessageType,
} from '../../types';

import upload from '../upload';
import { getSourceLogo } from '../source-logos';
import logger from '../logger';
import { channelMapDiscordToKook } from '../../app.config';

import sendMessage from './send-message';

// ============================================================================

const regexUrl =
    /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/;
function isUrlOnly(str: string): boolean {
    return new RegExp(
        `^${regexUrl.toString().replace(/^\/(.+)\/$/, '$1')}$`,
    ).test(str);
}

function transformMarkdown(input: string): string {
    return input.replace(
        /[^(](https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/g,
        `[$1]($1)`,
    );
}

type ExtendedCardMessageType = CardMessageType & {
    __type?: 'embed';
};

// ============================================================================

export async function syncMessage(message: Message) {
    const {
        id,
        channelId,
        createdTimestamp,
        author,
        // content,
        attachments,
        embeds,
    } = message;

    /**
     * 转换 TweetShift 的神奇格式
     * LINK [](ANOTHER_LINK) [](ANOTHER_LINK)
     * LINK [↧](ANOTHER_LINK) [↧](ANOTHER_LINK)
     */
    const content = message.content.replaceAll(
        new RegExp(
            ` \\[(↧| )\\]\\(${regexUrl
                .toString()
                .replace(/^\/(.+)\/$/, '$1')}\\)[$]*`,
            'g',
        ),
        '',
    );

    const avatar =
        !!author?.id && !!author?.avatar
            ? await upload(
                  `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.webp`,
              )
            : undefined;

    /** 用以提交的 Kook 结构的消息内容 */
    const postContent: ExtendedCardMessageType[] = [
        {
            type: 'card',
            theme:
                process.env.WEBPACK_BUILD_ENV === 'dev' ? 'none' : 'secondary',
            size: 'lg',
            modules: [
                {
                    type: 'context',
                    elements: [
                        !!avatar
                            ? {
                                  type: 'image',
                                  src: avatar,
                              }
                            : undefined,
                        { type: 'plain-text', content: author?.username },
                    ].filter((v) => !!v) as ModuleType[],
                },
                {
                    type: 'section',
                    text: {
                        type: 'kmarkdown',
                        content: transformMarkdown(content),
                    },
                },
            ],
        },
    ];

    // 处理图片附件 attachments
    const imageAttachments = [...attachments].filter(([, { contentType }]) =>
        /^image\//.test(`${contentType}`),
    );
    if (Array.isArray(imageAttachments)) {
        const images: string[] = [];
        for (const [, { url }] of imageAttachments) {
            images.push(await upload(url));
        }

        if (images.length === 1) {
            postContent[0].modules.push({
                type: 'container',
                elements: [
                    {
                        type: 'image',
                        src: images[0],
                    },
                ],
            });
        } else if (images.length > 1) {
            postContent[0].modules.push({
                type: 'image-group',
                elements: images.map((src) => ({
                    type: 'image',
                    src,
                })),
            });
        }
    }

    // 添加 source 信息
    postContent[0].modules.push({
        type: 'context',
        elements: [
            {
                type: 'image',
                src: await getSourceLogo('discord'),
            },
            {
                type: 'plain-text',
                content: [
                    'Discord',
                    new Intl.DateTimeFormat('zh-CN', {
                        dateStyle: 'long',
                        timeStyle: 'short',
                        timeZone: 'Asia/Shanghai',
                    }).format(new Date(createdTimestamp)),
                ]
                    .filter((v) => !!v)
                    .join(' · '),
            },
        ],
    });

    // 处理嵌入内容 embeds
    if (Array.isArray(embeds) && embeds.length > 0) {
        let index = 0;
        let lastImageModule: ModuleType;
        const cards: ExtendedCardMessageType[] = [];

        for (const {
            type,
            color,
            author,
            provider,
            title = '',
            description,
            image,
            // video,
            thumbnail,
            url,
            footer,
            timestamp,
        } of embeds as Array<
            Embed & {
                type: 'rich' | 'video' | 'image' | 'link' | 'article';
                author?: {
                    name?: string;
                    icon_url?: string;
                    url?: string;
                    proxy_icon_url?: string;
                };
                footer?: {
                    text?: string;
                    proxy_icon_url?: string;
                    icon_url?: string;
                };
            }
        >) {
            /**
             * 是否使用上一个卡片
             * - 没有标题时，认为仅为媒体，将媒体放入上一个卡片中
             */
            const useLastCard = !title && cards.length > 0;
            const thisCard: ExtendedCardMessageType = useLastCard
                ? cards[cards.length - 1]
                : {
                      type: 'card',
                      theme: 'secondary',
                      size: 'lg',
                      modules: [],
                      __type: 'embed',
                  };
            let thisIimageModule: ModuleType = useLastCard
                ? lastImageModule
                : undefined;

            // console.log(embeds[index]);
            if (typeof color === 'number') {
                delete thisCard['theme'];
                thisCard.color =
                    '#' + (color + Math.pow(16, 6)).toString(16).substr(-6);
            }
            async function addAuthor() {
                if (!author) return;
                thisCard.modules.push({
                    type: 'context',
                    elements: [
                        !!author.icon_url
                            ? {
                                  type: 'image',
                                  //   size: 'sm',
                                  src: await upload(author.icon_url),
                              }
                            : undefined,
                        !!author.url
                            ? {
                                  type: 'kmarkdown',
                                  content: `[${(author.name as string).replace(
                                      /\[(.+?)\]/g,
                                      '\\[$1\\]',
                                  )}](${author.url})`,
                              }
                            : {
                                  type: 'plain-text',
                                  content: author.name,
                              },
                    ].filter((v) => !!v) as ModuleType[],
                });
            }
            async function addProvider() {
                if (!provider) return;
                thisCard.modules.push({
                    type: 'context',
                    elements: [
                        !!provider.url
                            ? {
                                  type: 'kmarkdown',
                                  content: `[${(
                                      provider.name as string
                                  ).replace(/\[(.+?)\]/g, '\\[$1\\]')}](${
                                      provider.url
                                  })`,
                              }
                            : {
                                  type: 'plain-text',
                                  content: provider.name,
                              },
                    ],
                });
            }
            async function addImage(image: {
                width?: number;
                height?: number;
                url?: string;
                proxy_url?: string;
            }) {
                if (!thisIimageModule) {
                    thisIimageModule = {
                        type: 'container',
                        elements: [
                            {
                                type: 'image',
                                src: await upload(image.url as string),
                            },
                        ],
                    };
                    thisCard.modules.push(thisIimageModule);
                } else {
                    thisIimageModule.type = 'image-group';
                    thisIimageModule.elements?.push({
                        type: 'image',
                        src: await upload(image.url as string),
                    });
                }
            }
            switch (type) {
                case 'rich': {
                    if (
                        thisCard.modules.length > 1 &&
                        index > 0 &&
                        !!image &&
                        !description
                    ) {
                        await addImage(image);
                    } else {
                        await addAuthor();
                        if (!!description)
                            thisCard.modules.push({
                                type: 'section',
                                text: {
                                    type: 'kmarkdown',
                                    content: transformMarkdown(description),
                                    //
                                },
                            });
                        if (!!image) await addImage(image);
                    }
                    break;
                }
                case 'link': {
                    // console.log(embeds[index]);
                    await addProvider();
                    thisCard.modules.push({
                        type: 'section',
                        text: !!url
                            ? {
                                  type: 'kmarkdown',
                                  content: [
                                      !!url
                                          ? `**[${(title as string).replace(
                                                /\[(.+?)\]/g,
                                                '\\[$1\\]',
                                            )}](${url})**`
                                          : `**${title}**`,
                                      !!description
                                          ? transformMarkdown(description)
                                          : undefined,
                                  ]
                                      .filter((v) => !!v)
                                      .join('\n'),
                              }
                            : {
                                  type: 'plain-text',
                                  content: title as string,
                              },
                        mode: 'right',
                        accessory: !!thumbnail
                            ? {
                                  type: 'image',
                                  src: await upload(thumbnail?.url as string),
                                  size: 'sm',
                              }
                            : undefined,
                    });
                    // if (!!description)
                    //     thisContent.modules.push({
                    //         type: 'section',
                    //         text: {
                    //             type: 'kmarkdown',
                    //             content: transformMarkdown(description),
                    //             //
                    //         },
                    //     });
                    break;
                }
                case 'video': {
                    // await addProvider();
                    await addAuthor();
                    thisCard.modules.push({
                        type: 'section',
                        text: !!url
                            ? {
                                  type: 'kmarkdown',
                                  content: [
                                      !!url
                                          ? `**[${(title as string).replace(
                                                /\[(.+?)\]/g,
                                                '\\[$1\\]',
                                            )}](${url})**`
                                          : `**${title}**`,
                                  ]
                                      .filter((v) => !!v)
                                      .join('\n'),
                              }
                            : {
                                  type: 'plain-text',
                                  content: title as string,
                              },
                    });
                    // thisContent.modules.push({
                    //     type: 'video',
                    //     title: title,
                    //     src: url,
                    // });
                    if (!!thumbnail) await addImage(thumbnail);
                    thisCard.modules.push({
                        type: 'context',
                        elements: [
                            {
                                type: 'image',
                                src: await getSourceLogo('youtube'),
                            },
                            {
                                type: 'plain-text',
                                content: [
                                    'YouTube',
                                    !!timestamp
                                        ? new Intl.DateTimeFormat('zh-CN', {
                                              dateStyle: 'long',
                                              timeStyle: 'short',
                                              timeZone: 'Asia/Shanghai',
                                          }).format(new Date(timestamp))
                                        : undefined,
                                ]
                                    .filter((v) => !!v)
                                    .join(' · '),
                            },
                        ].filter((v) => !!v) as ModuleType[],
                    });
                    break;
                }
                case 'image':
                case 'article': {
                    await addProvider();
                    thisCard.modules.push({
                        type: 'section',
                        text: !!url
                            ? {
                                  type: 'kmarkdown',
                                  content: [
                                      !!url
                                          ? `**[${(title as string).replace(
                                                /\[(.+?)\]/g,
                                                '\\[$1\\]',
                                            )}](${url})**`
                                          : `**${title}**`,
                                      !!description
                                          ? transformMarkdown(description)
                                          : undefined,
                                  ]
                                      .filter((v) => !!v)
                                      .join('\n'),
                              }
                            : {
                                  type: 'plain-text',
                                  content: title as string,
                              },
                    });
                    if (!!thumbnail) await addImage(thumbnail);
                    break;
                }
                default: {
                    console.log(embeds[index]);
                    logger.warn({
                        type: 'UNRECOGNIZED_EMBED_TYPE',
                        embed: embeds[index],
                    });
                }
            }
            if (!!footer) {
                thisCard.modules.push({
                    type: 'context',
                    elements: [
                        {
                            type: 'image',
                            src: await getSourceLogo(
                                footer.text as MessageSource,
                                footer.icon_url,
                            ),
                        },
                        !!timestamp
                            ? {
                                  type: 'plain-text',
                                  content: [
                                      footer.text,
                                      new Intl.DateTimeFormat('zh-CN', {
                                          dateStyle: 'long',
                                          timeStyle: 'short',
                                          timeZone: 'Asia/Shanghai',
                                      }).format(new Date(timestamp)),
                                  ]
                                      .filter((v) => !!v)
                                      .join(' · '),
                              }
                            : undefined,
                    ].filter((v) => !!v) as ModuleType[],
                });
            }

            if (thisIimageModule) lastImageModule = thisIimageModule;
            if (!useLastCard && thisCard.modules.length > 0) {
                cards.push(thisCard);
            }

            index++;
        }

        cards.forEach((card) => {
            postContent.push(card);
        });
        // if (thisContent.modules.length > 0) {
        //     postContent.push(thisContent);
        // }
    }

    // console.log(postContent);
    logger.info({
        request: message,
        transformed: postContent,
    });

    // 检查所有消息模块，如果第一个模块满足以下条件，移除第一个模块
    // 没有附件
    // 内容仅为 URL
    // 后续存在 embed
    if (
        imageAttachments.length < 1 &&
        isUrlOnly(content) &&
        postContent.some(({ __type }) => __type === 'embed')
    ) {
        postContent.shift();
    }

    // 移除所有临时字段
    postContent.forEach((message) => {
        delete message['__type'];
    });

    // 递归检查
    {
        const checkObject = (m: ModuleType): ModuleType => {
            if (!m) return;
            if (Array.isArray(m.elements)) {
                m.elements = m.elements
                    .map((m) => checkObject(m))
                    .filter((m) => !!m);
            }
            if (Array.isArray(m.fields)) {
                m.fields = m.fields
                    .map((m) => checkObject(m))
                    .filter((m) => !!m);
            }
            if (m.type === 'image' && !m.src) {
                m = undefined;
            }
            return m;
        };
        postContent.forEach((message) => {
            message.modules = message.modules.map((m) => checkObject(m));
        });
    }

    const postData: MessageType = {
        type: 10,
        target_id:
            channelId in channelMapDiscordToKook
                ? channelMapDiscordToKook[
                      channelId as keyof typeof channelMapDiscordToKook
                  ]
                : '6086801551312186',
        content: JSON.stringify(postContent),
        discord_msg_id: id,
    };

    sendMessage(postData);

    return { data: 'sync-discord request queued.' };
}
export async function deleteMessage() {
    //
}
