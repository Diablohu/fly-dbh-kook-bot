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
