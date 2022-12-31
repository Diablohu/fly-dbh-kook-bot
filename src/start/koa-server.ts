import Koa from 'koa';
import koaRouter from 'koa-router';
// import { koaBody } from 'koa-body';
import bodyParser from 'koa-bodyparser';
import axios from 'axios';
import FormData from 'form-data';

import { port, newsChannelID } from '../../app.config';

// ============================================================================

async function startKoaServer(): Promise<Koa> {
    const app: Koa = new Koa();
    const headers = {
        Authorization: `Bot ${process.env.KOOK_TOKEN as string}`,
        'Content-type': 'application/json',
    };

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

        const { userid, username, useravatar, createAt, body, attachments } =
            ctx.request.body as {
                userid: string;
                username: string;
                useravatar: string;
                createAt: number;
                body: string;
                attachments: string;
            };

        const medias = {
            avatar: `https://cdn.discordapp.com/avatars/${userid}/${useravatar}.webp`,
            attachments: (
                JSON.parse(attachments) as {
                    url: string;
                    type: string;
                }[]
            ).filter(({ type }) => /^image\//.test(type)),
        };

        // 上传附件
        {
            async function upload(url: string): Promise<string> {
                const stream = await axios.get(url, {
                    responseType: 'stream',
                });
                const form = new FormData();
                // Pass image stream from response directly to form
                form.append('file', stream.data, 'avatar.webp');
                const res = await axios.post(
                    'https://www.kookapp.cn/api/v/asset/create',
                    form,
                    {
                        headers: {
                            ...headers,
                            'Content-type': 'form-data',
                        },
                    }
                );
                return res.data.data.url;
            }

            medias.avatar = await upload(medias.avatar);

            let index = 0;
            for (const { url } of medias.attachments) {
                // if (/^image\//.test(type)) {
                medias.attachments[index].url = await upload(url);
                // }
                index++;
            }
        }
        // console.log(medias);

        const content = [
            {
                type: 'card',
                theme: 'secondary',
                size: 'lg',
                modules: [
                    {
                        type: 'context',
                        elements: [
                            {
                                type: 'image',
                                src: medias.avatar,
                            },
                            { type: 'plain-text', content: username },
                            {
                                type: 'plain-text',
                                content: ` ${createAt}`,
                            },
                        ],
                    },
                    {
                        type: 'section',
                        text: {
                            type: 'kmarkdown',
                            content: body,
                        },
                    },
                ],
            },
        ];

        if (Array.isArray(medias.attachments)) {
            if (medias.attachments.length === 1) {
                content[0].modules.push({
                    type: 'container',
                    elements: [
                        {
                            type: 'image',
                            src: medias.attachments[0].url,
                        },
                    ],
                });
            } else if (medias.attachments.length > 1) {
                content[0].modules.push({
                    type: 'image-group',
                    elements: medias.attachments.map(({ type, url }) => ({
                        type: 'image',
                        src: url,
                    })),
                });
            }
        }

        content[0].modules.push({
            type: 'context',
            elements: [
                {
                    type: 'plain-text',
                    content: '来自【DBH 机器人】的自动消息',
                },
            ],
        });

        // console.log({ userid, username, useravatar }, content);

        const res = await axios.post(
            'https://www.kookapp.cn/api/v/message/create',
            {
                type: 10,
                target_id: newsChannelID,
                // content: (
                //     ctx.request.body as {
                //         content?: string;
                //     }
                // )?.content,
                content: JSON.stringify(content),
                nonce: `FLY-DBH-KOOK-BOT @ ${Date.now()}`,
            },
            {
                headers: {
                    ...headers,
                },
            }
        );

        console.log(res.data);

        ctx.body = res.data;
    });

    app.use(router.routes());

    // ========================================================================

    return app;
}

export default startKoaServer;
