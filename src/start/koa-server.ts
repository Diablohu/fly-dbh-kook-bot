import type { Message } from 'discord.js';

import path from 'node:path';
import Koa from 'koa';
import koaRouter from 'koa-router';
// import { koaBody } from 'koa-body';
import bodyParser from 'koa-bodyparser';
// import koaSendFile from 'koa-sendfile';

import type { MessageSource } from '../../types';

import { port } from '../../app.config';
import { syncMessage } from '../api/sync-message';
import { syncMessage as syncDiscordMessage } from '../api/sync-discord';
import { logError } from '../logger';

// ============================================================================

async function startKoaServer(): Promise<Koa> {
    console.log({ port });

    const app: Koa = new Koa();

    // app.use(async (ctx) => {
    //     ctx.body = 'Hello World';
    // });
    app.use(bodyParser());

    await new Promise((resolve) =>
        app.listen(port, async function () {
            resolve(undefined);
        }),
    ).catch((err) => {
        logError(err);
        console.error(err);
    });

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
                },
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

    // router.get(`/`, async (ctx) => {
    //     await koaSendFile(ctx, path.join(__dirname, 'index.html'));
    // });
    // router.get(`/release`, async (ctx) => {
    //     await koaSendFile(ctx, path.join(__dirname, 'index.html'));
    // });

    app.use(router.routes());

    // ========================================================================

    return app;
}

export default startKoaServer;
