/* eslint-disable no-restricted-globals */
// import type { AxiosHeaders } from 'axios';
import axios from 'axios';

import getDefaultHeaders from './headers';

// declare module 'axios' {
//     export interface AxiosRequestConfig {
//     }
// }
// interface CommonHeaderProperties extends AxiosHeaders {
//     Authorization: string;
// }

/** 拦截器是否已添加 */
let interceptorsAttached = false;

// ============================================================================

export function attachInterceptors(): void {
    if (interceptorsAttached) return;

    axios.interceptors.request.use(async (config) => {
        const { url, headers } = config;

        const thisUrl = new URL(url || '', 'https://www.kookapp.cn/');
        if (thisUrl.hostname === 'www.kookapp.cn') {
            for (const [key, value] of Object.entries(getDefaultHeaders())) {
                if (typeof headers[key] === 'undefined') headers[key] = value;
            }
            if (!/^\/api\/v/.test(thisUrl.pathname))
                thisUrl.pathname = '/api/v' + thisUrl.pathname;
        } else if (thisUrl.hostname === 'avwx.rest') {
            headers.Authorization = `BEARER ${
                process.env.AVWX_TOKEN as string
            }`;
        }

        // console.log(
        //     123,
        //     thisUrl.pathname,
        //     /\/api\/v\/(message|gateway)\//.test(thisUrl.pathname),
        // );
        // 2023/10/20: 由于 Kook 限制海外 IP 无法发言，转发所有 `/message` 请求到腾讯云
        // 2024/07/26: 由于腾讯云业务调整，转发目标所使用的 Serverless 服务将于 2025/06/30 关闭，需要在此之前进行迁移
        if (
            // process.env.WEBPACK_BUILD_ENV !== 'dev' &&
            /\/api\/v\/(message|gateway)\//.test(thisUrl.pathname)
        ) {
            const axiosSettings = {
                ...config,
                // url:
                //     process.env.WEBPACK_BUILD_ENV === 'dev'
                //         ? `http://localhost:9000/forward`
                //         : process.env.KOOK_BOT_FORWARD_REQUEST_URL,
                url: process.env.KOOK_BOT_FORWARD_URL,
                method: 'post',
                data: {
                    headers: config.headers,
                    url: thisUrl.href,
                    method: config.method,
                    ...config.data,
                },
            };
            // console.log('FORWARDING...', axiosSettings);
            return Promise.resolve(axiosSettings);
        }

        // console.log(thisUrl.href, headers);
        const axiosSettings = {
            ...config,
            url: thisUrl.href,
            headers,
        };
        return Promise.resolve(axiosSettings);
    });

    interceptorsAttached = true;
}
