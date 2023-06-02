import type { CardMessageType } from '../../types';

import './metar';
import './simbrief';

// ============================================================================

export type commandFunction = (
    args: string[]
) => Promise<string | CardMessageType>;

// ============================================================================

const commands: Record<string, commandFunction> = {};
const helpList: string[] = [];

// ============================================================================

async function getCommandResponse(
    command: string
): Promise<string | CardMessageType> {
    command = command.replace(/^\//, '');
    const [type, ...args] = command.split(' ');

    switch (type.toLowerCase()) {
        case 'help': {
            return helpList.map((msg) => `\`${msg}\``).join(`\n`);
        }
    }

    return (
        (await commands[type.toLowerCase()]?.(args)) ||
        '未知命令。输入 `/help` 可查看命令帮助。'
    );
}

export default getCommandResponse;

// ============================================================================

export function registerCommand(
    commandStr: string,
    func: commandFunction,
    helpMessage?: string
): void {
    setTimeout(() => {
        commands[commandStr.toLowerCase()] = func;
        if (helpMessage) helpList.push(helpMessage);
    });
}
