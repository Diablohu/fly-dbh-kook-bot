import type { Message, Embed } from 'discord.js';

import axios from 'axios';

import type { MessageSource, ModuleType, MessageType } from '../../types';

import getDefaultHeaders from '../headers';
import upload from '../upload';
import { getSourceLogo } from '../source-logos';
import logger, { logError } from '../logger';

// ============================================================================

/**
 * Discord 消息 ID -> Kook 消息 ID
 * - 用以标记该条 Discord 消息是否已在 Kook 发送过，如果是，`syncMessage` 则为编辑操作
 */
const messageMap = new Map();
/**
 * Discord 频道 ID -> Kook 频道 ID
 */
const channelMap: Record<string, string> = {
    '1057919252922892298': '6086801551312186', // bot channel

    // MSFS
    '983629937451892766': '6218098845719397', // fs news channel 1
    '1058110232972247103': '6218098845719397', // fs news channel 2
    '1060032674988826664': '6218098845719397', // fs news manual sync
    '1061038884143763538': '9294847620576543', // fs group

    // Other Games
    '1059769292717039626': '5037270702167031', // imas news channel
    '1069820588538986536': '4872647462994083', // kancolle news channel
};
if (process.env.WEBPACK_BUILD_ENV === 'dev') {
    channelMap['1061924579100078090'] = '6086801551312186';
}

function transformMarkdown(input: string): string {
    return input.replace(
        /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/g,
        `[$1]($1)`
    );
}

type ExtendedMessageType = MessageType & {
    __type?: 'embed';
};

type PostDataType = {
    type: 10;
    target_id: string;
    content: string;
    nonce: string;
    msg_id?: string;
    discord_msg_id: string;
};

// ============================================================================

const msgQueue: PostDataType[] = [];
function queueMsg(postData?: PostDataType): void {
    if (typeof postData === 'object') msgQueue.push(postData);
    msgQueueRun();
}
let msgQueueRunning = false;
let msgQueueRetryCount = 0;
async function msgQueueRun() {
    if (msgQueueRunning) return;
    if (msgQueue.length < 1) return;

    msgQueueRunning = true;
    console.log(msgQueue);
    const nextData = msgQueue.shift();

    async function runNext() {
        if (typeof nextData !== 'object') {
            msgQueueRunning = false;
            return;
        }

        try {
            const url =
                'https://www.kookapp.cn/api/v/message/' +
                (!!nextData.msg_id ? 'update' : 'create');
            const res = await axios.post(url, nextData, {
                headers: {
                    ...getDefaultHeaders(),
                },
            });

            console.log(res.data, res.data.data.msg_id);
            messageMap.set(nextData.discord_msg_id, res.data.data.msg_id);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            logError(e);
            // 报错后等待3秒再重试
            if (msgQueueRetryCount < 3) {
                await sleep(3000);
                await runNext();
                msgQueueRetryCount++;
            }
        }
    }

    await sleep(3000);
    await runNext();

    msgQueueRunning = false;
    msgQueueRetryCount = 0;

    msgQueueRun();
}
async function sleep(time: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, time));
}

// ============================================================================

export async function syncMessage(message: Message) {
    const {
        id,
        channelId,
        createdTimestamp,
        author,
        content,
        attachments,
        embeds,
    } = message;

    const avatar =
        !!author?.id && !!author?.avatar
            ? await upload(
                  `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.webp`
              )
            : undefined;

    /** 用以提交的 Kook 结构的消息内容 */
    const postContent: ExtendedMessageType[] = [
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
        /^image\//.test(`${contentType}`)
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
        const thisContent: ExtendedMessageType = {
            type: 'card',
            theme: 'secondary',
            size: 'lg',
            modules: [],
            __type: 'embed',
        };
        let index = 0;
        let imageModule: ModuleType;
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
            provider,
            title,
            description,
            image,
            // video,
            thumbnail,
            url,
            footer,
            timestamp,
        } of embeds as Array<
            Embed & {
                type: 'rich' | 'video' | 'link' | 'article';
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
            // console.log(embeds[index]);
            if (typeof color === 'number') {
                delete thisContent['theme'];
                thisContent.color =
                    '#' + (color + Math.pow(16, 6)).toString(16).substr(-6);
            }
            async function addAuthor() {
                if (!author) return;
                thisContent.modules.push({
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
                                      '\\[$1\\]'
                                  )}](${author.url}}](${author.url})`,
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
                thisContent.modules.push({
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
                        await addAuthor();
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
                    }
                    break;
                }
                case 'link': {
                    // console.log(embeds[index]);
                    await addProvider();
                    thisContent.modules.push({
                        type: 'section',
                        text: !!url
                            ? {
                                  type: 'kmarkdown',
                                  content: [
                                      !!url
                                          ? `**[${(title as string).replace(
                                                /\[(.+?)\]/g,
                                                '\\[$1\\]'
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
                    thisContent.modules.push({
                        type: 'section',
                        text: !!url
                            ? {
                                  type: 'kmarkdown',
                                  content: [
                                      !!url
                                          ? `**[${(title as string).replace(
                                                /\[(.+?)\]/g,
                                                '\\[$1\\]'
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
                    thisContent.modules.push({
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
                case 'article': {
                    await addProvider();
                    thisContent.modules.push({
                        type: 'section',
                        text: !!url
                            ? {
                                  type: 'kmarkdown',
                                  content: [
                                      !!url
                                          ? `**[${(title as string).replace(
                                                /\[(.+?)\]/g,
                                                '\\[$1\\]'
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
            index++;
        }
        if (thisContent.modules.length > 0) {
            postContent.push(thisContent);
        }
    }

    console.log(postContent);
    logger.info(postContent);

    // 检查所有消息模块，如果第一个模块满足以下条件，移除第一个模块
    // 没有附件
    // 内容仅为 URL
    // 后续存在 embed
    if (
        imageAttachments.length < 1 &&
        /^(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})$/.test(
            content
        ) &&
        postContent.some(({ __type }) => __type === 'embed')
    ) {
        postContent.shift();
    }

    // 移除所有临时字段
    postContent.forEach((message) => {
        delete message['__type'];
    });

    const postData: PostDataType = {
        type: 10,
        target_id:
            channelId in channelMap
                ? channelMap[channelId as keyof typeof channelMap]
                : '6086801551312186',
        content: JSON.stringify(postContent),
        nonce: `FLY-DBH-KOOK-BOT @ ${Date.now()}`,
        discord_msg_id: id,
    };

    if (messageMap.has(id)) {
        postData.msg_id = messageMap.get(id);
    }

    queueMsg(postData);

    return { data: 'sync-discord request queued.' };
}
export async function deleteMessage() {
    //
}
