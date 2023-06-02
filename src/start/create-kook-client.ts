import axios from 'axios';
import ws from 'ws';
import fs from 'fs-extra';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import path from 'node:path';

import {
    WSSignalTypes,
    WSMessageTypes,
    WSMessageType,
    MessageType,
} from '../../types';
import logger, { logError as _logError } from '../logger';
import { cacheDir } from '../../app.config';
import sendMessage from '../api/send-message';

import getCommandResponse from '../commands/index';

const unzip = promisify(zlib.unzip);

// ============================================================================

export let client: ws;
export const clientCacheFile = path.resolve(cacheDir, 'client.json');

function logInfo(msg: unknown) {
    const body: Record<string, unknown> = {
        connectionType: 'websocket-message',
    };
    if (typeof msg === 'string') body.message = msg;
    else body.message = msg;
    // console.log(body);
    logger.info(body);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function logError(err: any) {
    return _logError(err);
}

// let msgQueue = [];

// ============================================================================

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
async function createClient(): Promise<void> {
    const cache: {
        /** 常驻 session */
        sessionId: string;
        /** 序列码 */
        sn: number;
    } = fs.existsSync(clientCacheFile)
        ? await fs.readJson(clientCacheFile)
        : {};
    const { sessionId = '', sn = 0 } = cache;

    // 请求 Gateway 获取 WebSocket 连接地址
    const gateway = (
        await axios
            .get<{
                data: { url: string };
            }>('/gateway/index')
            .catch((err) => {
                logError(err);
            })
    )?.data.data.url;
    if (typeof gateway !== 'string') {
        return await createClient();
    }

    const wsParams: Record<string, string | number> = {
        compress: 1,
        sn,
    };
    if (!!sessionId) {
        wsParams.sessionId = sessionId;
        wsParams.resume = 1;
    }
    const wssUrl = new URL(gateway);
    for (const [key, value] of Object.entries(wsParams)) {
        wssUrl.searchParams.set(key, `${value}`);
    }

    // ========================================================================
    let pingTimeout: NodeJS.Timeout;
    let pingRetry = 0;

    async function reconnect(reason: string): Promise<void> {
        // console.log('Reconnecting... ' + reason);
        logInfo('Reconnecting... ' + reason);

        client.terminate();

        clearTimeout(pingTimeout);
        pingRetry = 0;

        cache.sessionId = '';
        cache.sn = 0;

        // msgQueue = [];

        await fs.writeJson(clientCacheFile, cache);
        await createClient();
    }

    client = new ws(wssUrl.href);

    client.on('open', () => {
        sendPing();
    });
    client.on('error', (...args) => {
        console.log('ERROR', ...args);
        logError(...args);
    });
    client.on('message', async (buffer: Buffer) => {
        const msg = (await unzip(buffer)).toString();
        let type: WSSignalTypes | undefined = undefined,
            body: string | { [key: string]: string | number } | WSMessageType =
                {},
            sn: number | undefined = undefined;
        try {
            const o = JSON.parse(msg);
            type = o.s;
            body = o.d;
            sn = o.sn;
            // console.log('WSS on Message (Object)', o);
        } catch (e) {
            body = msg;
            // console.log('WSS on Message', msg);
        }

        // 存在 type，表示正确的信息
        if (typeof type !== 'undefined') {
            // 获取的信息中存在 sn，刷新 cache
            if (typeof sn === 'number') cache.sn = sn;

            switch (type) {
                case WSSignalTypes.HandShake: {
                    if ((body as { [key: string]: number })?.code === 40103) {
                        console.log('Handshake Fail');
                        await reconnect('Handshake Fail');
                        return;
                    }
                    logInfo(body as { [key: string]: string });
                    // 握手成功，获取到 sessionId，刷新 cache
                    if (
                        typeof body === 'object' &&
                        !!(body as { [key: string]: string })?.sessionId
                    )
                        cache.sessionId = (body as { [key: string]: string })
                            ?.sessionId as string;
                    break;
                }
                case WSSignalTypes.RsumeAck: {
                    logInfo(body as { [key: string]: string });
                    // 重连成功，获取到 sessionId，刷新 cache
                    if (
                        typeof body === 'object' &&
                        !!(body as { [key: string]: string }).sessionId
                    )
                        cache.sessionId = (body as { [key: string]: string })
                            .sessionId as string;
                    break;
                }
                case WSSignalTypes.Pong: {
                    // 成功收到 PONG 回应，终止仍存在的 PING 重试尝试，开启新的 PING 倒计时
                    // console.log('PONG!', msg);
                    clearTimeout(pingTimeout);
                    pingRetry = 0;
                    sendPing();
                    break;
                }
                // 需要重连
                case WSSignalTypes.Reconnect: {
                    // 收到重连请求，进行重新连接
                    console.log('Signal Reconnect');
                    await reconnect('Signal Reconnect');
                    break;
                }
                default: {
                    await parseMsg(body as WSMessageType, sn as number);
                }
            }
        }

        await fs.writeJson(clientCacheFile, cache);
    });

    /** 发送 PING */
    function sendPing(
        /** 延迟时间 */
        time = 30 * 1000
    ): NodeJS.Timeout {
        if (client.readyState !== ws.OPEN) {
            pingTimeout = setTimeout(sendPing, 100);
            return pingTimeout;
        }

        pingTimeout = setTimeout(async () => {
            const ping = {
                s: WSSignalTypes.Ping,
                sn: cache.sn,
            };
            // console.log('PING!', ping);
            client.send(Buffer.from(JSON.stringify(ping)));
            if (pingRetry > 2) {
                await reconnect('Ping Failed after 2 retries');
            } else {
                pingRetry++;
                pingTimeout = sendPing(6 * 1000);
            }
        }, time);

        return pingTimeout;
    }

    async function parseMsg(body: WSMessageType, sn: number) {
        // 如果是机器人或系统消息，直接忽略
        if (
            (body.extra.type === WSMessageTypes.Markdown ||
                body.extra.type === WSMessageTypes.Card) &&
            (body.extra?.author?.bot === true ||
                body.extra?.author?.is_sys === true)
        )
            return;

        // 如果是以 `/` 开头的消息，判断为命令，进行分析
        if (
            body.type === WSMessageTypes.Markdown &&
            body.extra.type === WSMessageTypes.Markdown &&
            /^\//.test(body.content)
        ) {
            // 开发环境仅监控一个频道
            if (
                process.env.WEBPACK_BUILD_ENV === 'dev' &&
                body.target_id !== '6086801551312186'
            )
                return;

            const command = body.content.replace(/^\//, '');
            const channelId = body.target_id;
            const messageId = body.msg_id;

            logInfo({
                command,
                body,
                sn,
            });

            const response = await getCommandResponse(command).catch(logError);
            // console.log(response);
            if (typeof response === 'object' && response.type === 'card') {
                const msg: MessageType = {
                    type: 10,
                    target_id: channelId,
                    quote: messageId,
                    content: JSON.stringify([response]),
                };
                // console.log(msg);
                sendMessage(msg);
            } else if (typeof response === 'string' && !!response) {
                const msg: MessageType = {
                    type: 9,
                    target_id: channelId,
                    quote: messageId,
                    content: response,
                };
                // console.log(msg);
                sendMessage(msg);
            }

            return;
        }

        // 其他消息
        switch (body.type) {
            case WSMessageTypes.System: {
                switch (body.extra.type) {
                    case 'guild_member_offline':
                    case 'guild_member_online':
                    case 'updated_message': {
                        break;
                    }
                    default: {
                        // console.log('[WebSocket] SYSTEM MESSAGE', body);
                        // logInfo({ body, sn });
                    }
                }
                break;
            }
            default: {
                // console.log('[WebSocket] UNKNOWN MESSAGE', body);
                // logInfo({ body, sn });
            }
        }
    }
}

export default createClient;
