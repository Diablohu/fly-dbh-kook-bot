import axios from 'axios';

import type { MessageType } from '../../types';

import logger, { logError } from '../logger';
import sleep from '../sleep';

// ============================================================================

/**
 * Discord 消息 ID -> Kook 消息 ID
 * - 用以标记该条 Discord 消息是否已在 Kook 发送过，如果是，`syncMessage` 则为编辑操作
 */
const discordMessageMap = new Map();

// ============================================================================

const msgQueue: {
    message: MessageType;
    after?: () => unknown;
}[] = [];
let msgQueueRunning = false;
let msgQueueRetryCount = 0;

function queueMsg(postData?: MessageType, after?: () => unknown): void {
    if (typeof postData === 'object') {
        if (!postData.nonce)
            postData.nonce = `FLY-DBH-KOOK-BOT @ ${Date.now()}`;
        msgQueue.push({
            message: postData,
            after,
        });
    }
    msgQueueRun();
}
export default queueMsg;

async function msgQueueRun() {
    if (msgQueueRunning) return;
    if (msgQueue.length < 1) return;

    msgQueueRunning = true;
    // console.log(msgQueue);
    const next = msgQueue.shift();

    async function runNext() {
        if (typeof next !== 'object' || typeof next.message !== 'object') {
            msgQueueRunning = false;
            return;
        }

        if (discordMessageMap.has(next.message.discord_msg_id)) {
            next.message.msg_id = discordMessageMap.get(
                next.message.discord_msg_id,
            );
        }

        // console.log(next.message);
        try {
            const { discord_msg_id, ...msg } = next.message;
            const url = '/message/' + (!!msg.msg_id ? 'update' : 'create');
            const res = await axios.post(url, msg);

            // { code: 40000, message: '不支持该类型：header1', data: {}
            if (
                res.data.code === 40000 &&
                res.data.message === 'json格式不正确'
            ) {
                console.log(` `);
                console.log(`❓ [${res.data.code}] ${res.data.message} ❓`);
                console.log(`    Type: ${msg.type}`);
                console.log(`    Message: ${msg.content}`);
                console.log(` `);
                return await next.after?.();
            }

            if (res.data.code !== 0) {
                throw res;
            }

            // console.log('___', url, msg, res);
            if (discord_msg_id && res.data.data.msg_id)
                discordMessageMap.set(discord_msg_id, res.data.data.msg_id);

            logger.http({
                type: 'MSG_SENT',
                response: res.data,
                message_id: res.data.data.msg_id,
                message_map: discordMessageMap,
            });

            return await next.after?.();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            console.log(e);
            logError(e);

            // 如果报告 40000，说明格式有误，不进行重试
            // TODO: 报告给我？
            if (e?.data?.code === 40000) {
                // console.log(222, 2);
                return;
            }

            // 报错后等待3秒再重试
            // console.log(123, msgQueueRetryCount);
            if (msgQueueRetryCount < 2) {
                msgQueueRetryCount++;
                await sleep(3000);
                await runNext();
            }
        }
    }

    await sleep(3000);
    await runNext();

    msgQueueRunning = false;
    msgQueueRetryCount = 0;

    msgQueueRun();
}
