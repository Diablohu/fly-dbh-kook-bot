import axios from 'axios';
import { logError } from '../logger';
import { Command, CommandAction } from './';

// ============================================================================

async function commandAction(
    args: Parameters<CommandAction>[0],
    options: Parameters<CommandAction>[1]
): ReturnType<CommandAction> {
    const qStr = args[0];
    if (typeof qStr !== 'string' || qStr.length < 3) {
        return `> 🤓 请输入正确的 ICAO 或 IATA 机场代码`;
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

// registerCommand('metar', commandFunction, {
//     command: 'metar',
//     description: '查询机场气象报文',
//     arguments: ['<ICAO机场代码>'],
//     examples: ['/metar ZBAA', '/metar JFK'],
// });

setTimeout(() => {
    new Command('metar')
        .description('查询机场气象报文')
        .argument('<ICAO/IATA机场代码>')
        .example('/metar ZBAA')
        .example('/metar JFK')
        .action(commandAction);
});
