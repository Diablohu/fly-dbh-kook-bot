import axios, { AxiosResponse } from 'axios';
import FormData from 'form-data';
import { logError } from './logger';
import sleep from './sleep';

import getDefaultHeaders from './headers';

interface UploadResponse {
    data: {
        url: string;
    };
}

async function upload(url: string): Promise<string> {
    const stream = await axios
        .get(url, {
            responseType: 'stream',
        })
        .catch((e) => {
            // console.log(e);
            logError(e);
            throw e;
        });

    const form = new FormData();
    // Pass image stream from response directly to form
    form.append('file', stream.data /*, 'avatar.webp'*/);

    let retryCount = 0;

    const doUpload = async (): Promise<AxiosResponse<UploadResponse>> => {
        try {
            return await axios
                .post('/asset/create', form, {
                    headers: {
                        'Content-Type': 'form-data',
                        'Content-type': 'form-data',
                    },
                })
                .then((res) => {
                    console.log(res);
                    return res;
                });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            logError(e);

            // 报错后等待3秒再重试
            if (retryCount < 3) {
                retryCount++;
                await sleep(3000);
                return await doUpload();
            } else {
                return new Promise((resolve) =>
                    resolve({
                        data: {
                            data: {
                                url: '',
                            },
                        },
                    } as AxiosResponse<UploadResponse>)
                );
            }
        }
    };

    const res = await doUpload();
    // console.log('___', res);
    return res?.data?.data?.url;
}

export default upload;
