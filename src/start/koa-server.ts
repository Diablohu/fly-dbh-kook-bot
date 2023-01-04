import Koa from 'koa';
import koaRouter from 'koa-router';
// import { koaBody } from 'koa-body';
import bodyParser from 'koa-bodyparser';

import type { MessageSource } from '../../types';

import { port } from '../../app.config';
import { syncMessage } from '../api/sync-message';

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

    router.post('/sync-message', async (ctx) => {
        //
    });

    app.use(router.routes());

    // ========================================================================

    return app;
}

export default startKoaServer;
