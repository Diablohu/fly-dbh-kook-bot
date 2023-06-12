import { MessageTypes } from '../../types';

import { Command, CommandAction } from './';
import upload from '../upload';

// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function commandAction(
    args: Parameters<CommandAction>[0],
    options: Parameters<CommandAction>[1]
): ReturnType<CommandAction> {
    return {
        type: MessageTypes.Picture,
        content: await upload(
            'https://img.kookapp.cn/assets/2023-06/Y8QssmHGKC08d051.gif'
        ),
    };
}

// ============================================================================

// registerCommand('simbrief', commandFunction, {
//     command: 'simbrief',
//     description: '查询目标用户在 SimBrief 最近签派的飞行计划',
//     arguments: ['<用户名或用户ID>'],
//     examples: ['/simbrief diablohu', '/simbrief 392663'],
// });
// registerCommand('sb', commandFunction);

setTimeout(() => {
    new Command('jorgnod').help(false).action(commandAction);
});
