import axios from 'axios';
import { io } from 'socket.io-client';
import ws from 'ws';

import logger, { logError } from '../logger';

let client;

/**                                                _________________
 *       获取gateWay     连接ws          收到hello |    心跳超时    |
 *             |           |                |      |      |         |
 *             v           v                v      |      V         |
 *      INIT  --> GATEWAY -->  WS_CONNECTED --> CONNECTED --> RETRY |
 *       ^        |   ^             |                  ^_______|    |
 *       |        |   |_____________|__________________________|    |
 *       |        |                 |                          |    |
 *       |________|_________________|__________________________|____|
 *
 **/
async function connectKoot() {
    /** 常驻 session */
    const sessionId = '';
    /** 序列码 */
    const sn = 0;

    // 请求 Gateway 获取 WebSocket 连接地址
    const gateway = (
        await axios.get<{
            data: { url: string };
        }>('/gateway/index')
    )?.data.data.url;
    const params: Record<string, string | number> = {
        resume: 1,
        compress: 0,
        sn,
    };
    if (!!sessionId) {
        params.sessionId = sessionId;
    }
    const wssUrl = new URL(gateway);
    for (const [key, value] of Object.entries(params)) {
        wssUrl.searchParams.set(key, `${value}`);
    }

    const socket = new ws(wssUrl.href);

    socket.on('open', async (...args) => {
        console.log('WSS Open', ...args);
    });
    socket.on('message', async (buffer: Buffer) => {
        console.log('WSS on Message', buffer.toString());
    });

    // https://developer.kookapp.cn/doc/websocket
    // TODO: 严格按照文档流程实现首次连接 s===1 即为 'HELLO'
    // TODO: 存储 sessionId 到本地文件
    // TODO: 还原 sessionId 并实现重连
    // TODO: 区分 s 值
    // TODO: 严格按照文档流程实现心跳
    // TODO: 严格按照文档流程实现重连
    // TODO: 尝试监控一类消息
    // TODO: /help
    // TODO: /metar ICAO (eg. /metar ZBAA)

    // const socket = io(wssUrl.href, {
    //     transports: ['websocket'],
    //     query: {},
    // });
    // socket.on('connect_error', (error) => {
    //     console.error(error);
    // });
    // socket.on('error', (...args) => {
    //     console.log(...args);
    // });
    // socket.on('connect', () => {
    //     console.log(123);
    //     console.log('\n\n\n\n\n\n');
    //     logger.info('WSS Connected! ' + socket.id);
    // });

    // socket.on('disconnect', () => {
    //     console.log('WSS Disconected! ' + socket.id); // undefined
    // });
}

export default connectKoot;
