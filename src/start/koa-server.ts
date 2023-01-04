import Koa from 'koa';
import koaRouter from 'koa-router';
// import { koaBody } from 'koa-body';
import bodyParser from 'koa-bodyparser';
import axios from 'axios';

import type { MessageSource } from '../../types';

import getDefaultHeaders from '../headers';
import upload from '../upload';
import { messageMap } from '../main';
import { getSourceLogo } from '../source-logos';
import { port, newsChannelID } from '../../app.config';

// ============================================================================

async function startKoaServer(): Promise<Koa> {
    const app: Koa = new Koa();

    // app.use(async (ctx) => {
    //     ctx.body = 'Hello World';
    // });
    app.use(bodyParser());

    await new Promise((resolve) =>
        app.listen(port, async function () {
            resolve(undefined);
        })
    );

    console.log(`Listening port ${port}`);

    // ========================================================================

    /** 服务器路由对象 (koa-router) */
    const router = new koaRouter();

    router.post('/sync-discord-bot', async (ctx) => {
        ctx.set('Access-Control-Allow-Origin', '*');

        const {
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
        } = ctx.request.body as {
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
            }[];
            source?: MessageSource;
        };

        const avatar = !userAvatar ? undefined : await upload(userAvatar);

        const content = [
            {
                type: 'card',
                theme: 'secondary',
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
                            { type: 'plain-text', content: userName },
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
                            content: body.replace(
                                /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/g,
                                `[$1]($1)`
                            ),
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
                        : {
                              type: 'image',
                              src: sourceLogo,
                          },
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
                    },
                ].filter((v) => !!v),
            });
        }

        // TODO: 处理 embed
        if (Array.isArray(embeds) && embeds.length > 0) {
            console.log(embeds);
        }
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

        ctx.body = res.data;
    });

    router.post('/sync-message', async (ctx) => {
        //
    });

    app.use(router.routes());

    // ========================================================================

    return app;
}

export default startKoaServer;
