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

const msgQueue: MessageType[] = [];
let msgQueueRunning = false;
let msgQueueRetryCount = 0;

function queueMsg(postData?: MessageType): void {
    if (typeof postData === 'object') {
        if (!postData.nonce)
            postData.nonce = `FLY-DBH-KOOK-BOT @ ${Date.now()}`;
        msgQueue.push(postData);
    }
    msgQueueRun();
}
export default queueMsg;

async function msgQueueRun() {
    if (msgQueueRunning) return;
    if (msgQueue.length < 1) return;

    msgQueueRunning = true;
    // console.log(msgQueue);
    const nextData = msgQueue.shift();

    async function runNext() {
        if (typeof nextData !== 'object') {
            msgQueueRunning = false;
            return;
        }

        if (discordMessageMap.has(nextData.discord_msg_id)) {
            nextData.msg_id = discordMessageMap.get(nextData.discord_msg_id);
        }

        // console.log(nextData);
        try {
            const { discord_msg_id, ...msg } = nextData;
            const url = '/message/' + (!!msg.msg_id ? 'update' : 'create');
            const res = await axios.post(url, msg);

            // console.log('___', url, msg, res);
            if (discord_msg_id && res.data.data.msg_id)
                discordMessageMap.set(discord_msg_id, res.data.data.msg_id);

            logger.http({
                type: 'MSG_SENT',
                response: res.data,
                message_id: res.data.data.msg_id,
                message_map: discordMessageMap,
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            console.log(e);
            logError(e);
            // 报错后等待3秒再重试
            if (msgQueueRetryCount < 3) {
                await sleep(3000);
                await runNext();
                msgQueueRetryCount++;
            }
        }
    }

    await sleep(3000);
    await runNext();

    msgQueueRunning = false;
    msgQueueRetryCount = 0;

    msgQueueRun();
}
