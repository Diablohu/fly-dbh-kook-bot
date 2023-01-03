import axios from 'axios';
import FormData from 'form-data';

import getDefaultHeaders from './headers';

async function upload(url: string): Promise<string> {
    const stream = await axios.get(url, {
        responseType: 'stream',
    });
    const form = new FormData();
    // Pass image stream from response directly to form
    form.append('file', stream.data, 'avatar.webp');
    const res = await axios.post(
        'https://www.kookapp.cn/api/v/asset/create',
        form,
        {
            headers: {
                ...getDefaultHeaders(),
                'Content-type': 'form-data',
            },
        }
    );
    return res.data.data.url;
}

export default upload;
