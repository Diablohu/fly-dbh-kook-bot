import axios from 'axios';
import { logError } from '../logger';
import { registerCommand } from './';

// ============================================================================

const helpMessage = '/metar [ICAO/IATA] 查询机场气象报文，例 /metar ZBAA';

async function commandFunction(query: string[]): Promise<string> {
    const qStr = query[0];
    if (typeof qStr !== 'string' || qStr.length < 3) {
        return `> 🤓 请输入正确的 ICAO 机场代码`;
        // throw new Error('Wrong ICAO');
    }

    const res = await axios
        .get(
            `https://avwx.rest/api/metar/${qStr.toUpperCase()}?options=&airport=true&reporting=true&format=json&remove=&filter=sanitized&onfail=cache`
        )
        .catch((err) => {
            // console.error(err);
            logError(err);
            return err;
        });

    // console.log(res.response.data, Object.keys(res));

    const result = res?.data?.sanitized || '';

    if (result === '') {
        if (res?.response?.data?.param === 'station')
            return `> 😣 查询 ${qStr.toUpperCase()} 气象报文失败: 机场未找到`;
        return `> 😣 查询 ${qStr.toUpperCase()} 气象报文失败: 未知错误`;
    }

    // console.log(`> ${result}`);
    // return `**${qStr.toUpperCase()}** 机场当前气象报文 (METAR)\n \`${result}\``;
    return `> \`${result}\``;
}

// ============================================================================

registerCommand('metar', commandFunction, helpMessage);
