import { Command } from 'commander';
import type { CardMessageType } from '../../types';

import './metar';
import './simbrief';

// ============================================================================

export type commandFunction = (
    args: string[]
) => Promise<string | CardMessageType>;
type CommandHelpType = {
    command: string;
    description: string;
    examples: string[];
    arguments?: string[];
    options?: string;
};

// ============================================================================

const commands: Record<string, commandFunction> = {};
const helpList: CommandHelpType[] = [];
let helpAllMsg: string;
export const program = new Command().option('-p, --public', '公开回复信息');
export const resultByCommandName: Map<string, string> = new Map();

// ============================================================================

async function getCommandResponse(
    command: string
): Promise<string | CardMessageType> {
    command = command.replace(/^\//, '');
    const [type, ...args] = command.split(' ');

    switch (type.toLowerCase()) {
        case 'help': {
            if (!helpAllMsg) {
                helpAllMsg = `\`\`\`markdown\n${helpList
                    .map((help) => {
                        return `${help.description}\n     /${help.command} ${
                            Array.isArray(help.arguments)
                                ? help.arguments.join(' ')
                                : ''
                        }\n  例 ${help.examples.join('\n     ')}`;
                    })
                    .join('\n\n')}\`\`\``;
            }
            return helpAllMsg;
        }
        default: {
            return (
                (await commands[type.toLowerCase()]?.(args)) ||
                '未知命令。输入 `/help` 可查看命令帮助。'
            );
        }
    }
}

export default getCommandResponse;

// ============================================================================

export function registerCommand(
    commandStr: string,
    func: commandFunction,
    helpMessage?: CommandHelpType
): void {
    setTimeout(() => {
        commands[commandStr.toLowerCase()] = func;
        if (helpMessage) helpList.push(helpMessage);
    });
}

export function setResult(comand: string, result: string): void {
    resultByCommandName.set(comand, result);
}
