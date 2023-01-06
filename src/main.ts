import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import Koa from 'koa';
import * as dotenv from 'dotenv';
import Listr from 'listr';

import startKoaServer from './start/koa-server';
import logger from './logger';

// ============================================================================

dotenv.config();
if (!process.env.KOOK_TOKEN) {
    process.env.KOOK_TOKEN =
        !!process.env.KOOK_TOKEN_FILE &&
        fs.existsSync(process.env.KOOK_TOKEN_FILE)
            ? fs.readFileSync(process.env.KOOK_TOKEN_FILE, 'utf-8')
            : '';
}

// ============================================================================

export let app: Koa;
export const messageMap = new Map();

// ============================================================================

let launched = false;
(async function () {
    if (launched) return;
    /** 当前是否是开发环境 */
    const isEnvDevelopment = process.env.WEBPACK_BUILD_ENV === 'dev';

    // 如果是开发环境，检查 `.env` 文件是否存在
    if (isEnvDevelopment) {
        const rootEnvFile = path.resolve(
            path.dirname(fileURLToPath(import.meta.url)),
            '../.env'
        );
        if (!fs.existsSync(rootEnvFile)) throw new Error('.env file missing');
    }

    // 注册结束进程
    process.on('exit', () => {
        // Koa.
    });

    // 开始流程
    new Listr([
        {
            title: 'Starting Koa server',
            task: startKoaServer,
        },
    ])
        .run()
        .catch((err) => {
            const loggerData: Record<string, unknown> = {
                type: 'ERROR',
                error: err,
                message: err.message,
            };

            console.log('\n');
            console.error(err);

            if (err.response) {
                loggerData.type = 'AXIOS_ERROR';
                loggerData.response = err.response;
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                console.log(err.response?.data);
                console.log(err.response?.status);
                console.log(err.response?.headers);
            }
            if (err.request) {
                loggerData.type = 'AXIOS_ERROR';
                loggerData.request = err.request;
                // The request was made but no response was received
                // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                // http.ClientRequest in node.js
                console.log(err.request);
            }
            if (err.config) {
                loggerData.config = err.config;
                console.log(err.config);
            }
        });

    launched = true;
})();
