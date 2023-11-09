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
        //     /\/api\/v\/message\//.test(thisUrl.pathname),
        // );
        // 2023/10/20: 由于 Kook 限制海外 IP 无法发言，转发所有 `/message` 请求到腾讯云
        if (
            process.env.WEBPACK_BUILD_ENV !== 'dev' &&
            /\/api\/v\/message\//.test(thisUrl.pathname)
        ) {
            const axiosSettings = {
                ...config,
                // url:
                //     process.env.WEBPACK_BUILD_ENV === 'dev'
                //         ? `http://localhost:9000/forward`
                //         : `https://1321773305-lexjg3zrkj-gz.scf.tencentcs.com/forward`,
                url: `https://1321773305-lexjg3zrkj-gz.scf.tencentcs.com/forward`,
                method: 'post',
                data: {
                    headers: config.headers,
                    url: thisUrl.href,
                    ...config.data,
                },
            };
            console.log(axiosSettings);
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
