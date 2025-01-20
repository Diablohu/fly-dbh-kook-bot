import axios from 'axios';
import ws from 'ws';
import fs from 'fs-extra';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import path from 'node:path';
import dayjs, { type Dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import {
    WSSignalTypes,
    WSMessageTypes,
    WSMessageType,
    // MessageType,
} from '../../types';
import logger, { logError as _logError } from '../logger';
import { cacheDir } from '../../app.config';
import sendMessage from '../api/send-message';
import { debugKookClient } from '../debug';
import { kookPublicResponseChannelIDs } from '@/vars';

import getCommandResponse from '../commands/index';

const unzip = promisify(zlib.unzip);
dayjs.extend(relativeTime);

// ============================================================================

export let client: ws;
export const clientCacheFile = path.resolve(cacheDir, 'client.json');
let clientOpenAt: Dayjs;
let keepClientTimeout: NodeJS.Timeout;
let pingTimeout: NodeJS.Timeout;
let pingRetryCount = 0;
const pingIntervalTime = 29_500;
let lastPingTime = 0;
let cache: {
    /** 常驻 session */
    sessionId?: string;
    /** 序列码 */
    sn?: number;
};

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

function getReadyStateString(state: typeof client.readyState): string {
    const readyStates = {
        [ws.CONNECTING]: 'CONNECTING',
        [ws.OPEN]: 'OPEN',
        [ws.CLOSING]: 'CLOSING',
        [ws.CLOSED]: 'CLOSED',
    };
    return `[${state}] ${readyStates[state] || 'UNKNOWN'}`;
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
    keepClient();

    debugKookClient('Creating...');

    try {
        cache = fs.existsSync(clientCacheFile)
            ? (await fs.readJson(clientCacheFile)) || {}
            : {};
    } catch (e) {
        cache = {};
    }
    const { sessionId = '', sn = 0 } = cache;

    Object.entries(cache).forEach(([key, value]) => {
        debugKookClient(`Cached ${key}: ${JSON.stringify(value)}`);
    });

    debugKookClient(`Retriving WebSocket URL...`);

    // 请求 Gateway 获取 WebSocket 连接地址
    const gateway = (
        await axios
            .get<{
                data: { url: string };
            }>('/gateway/index')
            .catch((err) => {
                console.log({ err });
                // logError(err);
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

    debugKookClient(`Retrived WebSocket URL: ${JSON.stringify(wssUrl.href)}`);

    for (const [key, value] of Object.entries(wsParams)) {
        wssUrl.searchParams.set(key, `${value}`);
    }

    // ========================================================================

    client = new ws(wssUrl.href);

    client.on('open', () => {
        clientOpenAt = dayjs(new Date());
        debugKookClient(
            `✅ WebSocket Client ${getReadyStateString(client?.readyState)}`,
        );
        sendPing();
    });
    client.on('error', (...args) => {
        debugKookClient('WebSocket Client Error', ...args);
        logError(...args);
        if (!client) return reconnect('💀 Crash On Starting');
        if (typeof client.readyState === 'undefined')
            return reconnect('💀 Crash On Starting');
        if (client.readyState === ws.CLOSED) reconnect('💀 Crash On Error');
    });
    client.on('message', async (buffer: Buffer) => {
        const msg = (
            await unzip(buffer as unknown as zlib.InputType)
        ).toString();
        let type: WSSignalTypes | undefined = undefined,
            body: string | { [key: string]: string | number } | WSMessageType =
                {},
            sn: number | undefined = undefined;
        // console.log(msg);
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
                        debugKookClient('Handshake Fail');
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
                    debugKookClient(`🤝 PONG!`);
                    pingRetryCount = 0;
                    sendPing();
                    break;
                }
                // 需要重连
                case WSSignalTypes.Reconnect: {
                    // 收到重连请求，进行重新连接
                    debugKookClient('📡 Signal Reconnect');
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
    client.on('close', async (code, reason) => {
        // const reasonText = (
        //     await unzip(reason as unknown as zlib.InputType)
        // ).toString();
        debugKookClient(
            [`⛔`, `WebSocket Client Closed [${code}]`, `${reason?.toString()}`]
                .filter((s) => s !== '')
                .join(' '),
        );
    });

    /** 发送 PING */
    function sendPing(
        /**
         * 延迟时间
         * - 两次 Ping 之间不超过 `pingIntervalTime` 毫秒
         */
        delay = Math.min(
            pingIntervalTime,
            lastPingTime
                ? pingIntervalTime - Date.now() + lastPingTime
                : pingIntervalTime,
        ),
    ): void {
        // console.log({ delay });
        // console.log(client?.readyState);
        switch (client?.readyState) {
            case ws.CONNECTING: {
                break;
            }
            case ws.OPEN: {
                if (pingTimeout) clearTimeout(pingTimeout);
                pingTimeout = setTimeout(() => {
                    const ping = {
                        s: WSSignalTypes.Ping,
                        sn: cache.sn,
                    };
                    // console.log('PING!', ping, client?.readyState);
                    debugKookClient(`👋 PING!`);
                    client.send(Buffer.from(JSON.stringify(ping)));
                    lastPingTime = Date.now();
                    // console.log({ pingRetryCount });
                    if (pingRetryCount > 1) {
                        reconnect('Ping Failed after 2 retries');
                    } else {
                        pingRetryCount++;
                        sendPing(6_000);
                    }
                }, delay);
                break;
            }
            // case ws.CLOSING:
            // case ws.CLOSED: {
            //     break;
            // }
            default: {
                reconnect(
                    `💀 Client ${getReadyStateString(client?.readyState)} before sending Ping signal`,
                );
            }
        }
    }

    async function parseMsg(body: WSMessageType, sn: number) {
        // 如果是机器人或系统消息，直接忽略
        if (
            (body?.extra?.type === WSMessageTypes.Markdown ||
                body?.extra?.type === WSMessageTypes.Card) &&
            (body?.extra?.author?.bot === true ||
                body?.extra?.author?.is_sys === true)
        )
            return;

        // 如果是以 `/` 开头的消息，判断为命令，进行分析
        if (
            body?.type === WSMessageTypes.Markdown &&
            body?.extra?.type === WSMessageTypes.Markdown &&
            /^\//.test(body?.content)
        ) {
            // 开发环境仅监控一个频道
            if (
                process.env.WEBPACK_BUILD_ENV === 'dev' &&
                body?.target_id !== '6086801551312186'
            )
                return;

            const command = body?.content.replace(/^\//, '');
            const channelId = body?.target_id;
            const messageId = body?.msg_id;

            logInfo({
                command,
                body,
                sn,
            });

            const response = await getCommandResponse(command).catch(logError);

            const isPublic =
                kookPublicResponseChannelIDs.includes(channelId) &&
                response?._is_temp !== true;
            delete response?._is_temp;
            if (!isPublic)
                await axios.post('/message/delete', {
                    msg_id: messageId,
                });

            if (response) {
                // console.log(response);
                // console.log(123, {
                //     target_id: channelId,
                //     quote: messageId,
                //     ...response,
                // });
                sendMessage({
                    target_id: channelId,
                    quote: isPublic ? messageId : undefined,
                    temp_target_id: isPublic ? undefined : body.author_id,
                    ...response,
                });
            } else {
                sendMessage({
                    target_id: channelId,
                    quote: isPublic ? messageId : undefined,
                    temp_target_id: isPublic ? undefined : body.author_id,
                    type: 9,
                    content: '😣 未知错误',
                });
            }
            /*
            // console.log(response);
            if (typeof response === 'object' && response.type === 'card') {
                const msg: MessageType = {
                    type: 10,
                    target_id: channelId,
                    quote: messageId,
                    content: JSON.stringify([response]),
                    // temp_target_id
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
            */

            return;
        }

        // 其他消息
        switch (body?.type) {
            case WSMessageTypes.System: {
                switch (body?.extra?.type) {
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
            case WSMessageTypes.Video:
            case WSMessageTypes.Image:
            case WSMessageTypes.Markdown:
            case WSMessageTypes.Card: {
                break;
            }
            default: {
                debugKookClient('❔ Unknown WebSocket Message Type', body);
                // logInfo({ body, sn });
            }
        }
    }
}

export default createClient;

// ============================================================================

async function reconnect(reason: string): Promise<void> {
    debugKookClient('🔄 Reconnecting... ' + reason);
    logInfo('Reconnecting... ' + reason);

    if (keepClientTimeout) clearTimeout(keepClientTimeout);
    if (pingTimeout) clearTimeout(pingTimeout);
    pingRetryCount = 0;

    client.terminate();

    cache.sessionId = '';
    cache.sn = 0;

    // msgQueue = [];

    await fs.writeJson(clientCacheFile, cache);
    await createClient();
}

// ============================================================================

function keepClient(delay = 100_000) {
    if (keepClientTimeout) clearTimeout(keepClientTimeout);

    if (client && client.readyState)
        debugKookClient(
            `💓 Vital: ${getReadyStateString(client.readyState)} (${clientOpenAt.fromNow(true)})`,
        );

    switch (client.readyState) {
        case ws.CLOSED: {
            reconnect('💀 No Vital');
            break;
        }
        default: {
            keepClientTimeout = setTimeout(keepClient, delay);
        }
    }
}
