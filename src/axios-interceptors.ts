/* eslint-disable no-restricted-globals */
import type { AxiosHeaders } from 'axios';
import axios from 'axios';

import getDefaultHeaders from './headers';

// declare module 'axios' {
//     export interface AxiosRequestConfig {
//     }
// }
interface CommonHeaderProperties extends AxiosHeaders {
    Authorization: string;
}

// ============================================================================

const ensureBaseHeaders = (
    headers: AxiosHeaders
): Partial<CommonHeaderProperties> => {
    return {
        ...getDefaultHeaders(),
        ...headers,
    };
};

/** 拦截器是否已添加 */
let interceptorsAttached = false;

// ============================================================================

export function attachInterceptors(): void {
    if (interceptorsAttached) return;
    axios.interceptors.request.use(async (config) => {
        const { url, headers } = config;

        const thisUrl = new URL(url || '', 'https://www.kookapp.cn/');
        if (
            thisUrl.hostname === 'www.kookapp.cn' &&
            !/^\/api\/v/.test(thisUrl.pathname)
        ) {
            thisUrl.pathname = '/api/v' + thisUrl.pathname;
        }

        const axiosSettings = {
            ...config,
            url: thisUrl.href,
            headers: ensureBaseHeaders(headers) as CommonHeaderProperties,
        };
        return Promise.resolve(axiosSettings);
    });

    interceptorsAttached = true;
}
