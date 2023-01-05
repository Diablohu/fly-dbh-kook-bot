import type { Message } from 'discord.js';

import Koa from 'koa';
import koaRouter from 'koa-router';
// import { koaBody } from 'koa-body';
import bodyParser from 'koa-bodyparser';

import type { MessageSource } from '../../types';

import { port } from '../../app.config';
import { syncMessage } from '../api/sync-message';
import { syncMessage as syncDiscordMessage } from '../api/sync-discord';

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

        ctx.body = (
            await syncMessage(
                ctx.request.body as {
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
                }
            )
        ).data;
    });

    router.post('/sync-discord-message', async (ctx) => {
        ctx.set('Access-Control-Allow-Origin', '*');
        ctx.body = (await syncDiscordMessage(ctx.request.body as Message)).data;
    });
    // router.delete('/sync-discord', async (ctx) => {
    //     ctx.set('Access-Control-Allow-Origin', '*');
    //     ctx.body = (await syncDiscordMessage(ctx.request.body)).data;
    // });

    app.use(router.routes());

    // ========================================================================

    return app;
}

export default startKoaServer;
