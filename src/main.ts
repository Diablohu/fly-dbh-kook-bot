import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import Koa from 'koa';
import * as dotenv from 'dotenv';
import Listr from 'listr';

import initDirs from './start/init-dirs';
import startKoaServer from './start/koa-server';
import createKookClient from './start/create-kook-client';
import logger from './logger';
import { attachInterceptors as attachAxiosInterceptors } from './axios-interceptors';

// ============================================================================

dotenv.config();
function prepareEnvKey(key: string): void {
    if (!process.env[`${key}`]) {
        process.env[`${key}`] =
            !!process.env[`${key}_FILE`] &&
            fs.existsSync(process.env[`${key}_FILE`] || '')
                ? fs.readFileSync(process.env[`${key}_FILE`] || '', 'utf-8')
                : '';
    }
}
prepareEnvKey('KOOK_TOKEN');
prepareEnvKey('AVWX_TOKEN');

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
            '../.env',
        );
        if (!fs.existsSync(rootEnvFile)) throw new Error('.env file missing');
    }

    // 注册结束进程
    process.on('exit', () => {
        // Koa.
    });

    attachAxiosInterceptors();

    // 开始流程
    new Listr([
        {
            title: 'Initializing directories',
            task: initDirs,
        },
        {
            title: 'Starting Koa server',
            task: startKoaServer,
        },
        {
            title: 'Connecting Kook & creating client',
            task: createKookClient,
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

            logger.error(loggerData);
        });

    launched = true;
})();
