// import { Command } from 'commander';
import type { CardMessageType, MessageType } from '../../types';

import './emotes';
import './metar';
import './simbrief';

// ============================================================================

export type CommandAction = (
    args: string[],
    options: Record<string, string | boolean>
) => Promise<string | CardMessageType | Omit<MessageType, 'target_id'>>;

// ============================================================================

const commands: Record<string, Command> = {};
let helpAllMsg: string;

// ============================================================================

async function getCommandResponse(
    command: string
): Promise<Omit<MessageType, 'target_id'>> {
    command = command.replace(/^\//, '');
    const [type, ...args] = command.split(' ');
    const commandStr = type.toLowerCase();

    switch (commandStr) {
        case 'help': {
            if (!helpAllMsg) {
                helpAllMsg = `\`\`\`markdown\n${Object.values(commands)
                    .map((c) => c.getHelp())
                    .filter((str) => !!str)
                    .join('\n\n')}\`\`\``;
            }
            return {
                type: 9,
                content: helpAllMsg,
                _is_temp: true,
            };
        }
        default: {
            return (
                (await commands[commandStr]?.parse?.(args.join(' '))) || {
                    type: 9,
                    content: '未知命令。输入 `/help` 可查看命令帮助。',
                    _is_temp: true,
                }
            );
        }
    }
}

export default getCommandResponse;

// ============================================================================

export class Command {
    constructor(cmdStr: string, cmdDesc?: string, cmdAction?: CommandAction) {
        // super()
        this._cmd = cmdStr;
        if (typeof cmdDesc === 'string') this._desc = cmdDesc;
        if (typeof cmdAction === 'function') this._actFunction = cmdAction;

        commands[this._cmd] = this;
    }

    private _cmd!: string;
    private _desc?: string;
    private _examples: string[] = [];
    private _args: string[] = [];
    private _optionsShort: Record<string, string> = {
        p: 'public',
    };
    private _actFunction!: CommandAction;
    private _helpMessage!: string | false;

    async parse(cmd: string): Promise<Omit<MessageType, 'target_id'>> {
        const parts = cmd.split(' ').map((s) => s.trim());
        if (parts[0] === this._cmd) parts.shift();

        const args: Parameters<CommandAction>[0] = [];
        const options: Parameters<CommandAction>[1] = {};

        parts.forEach((str) => {
            if (/^-/.test(str)) {
                const opt = str.replace(/^-+/, '').split('=');
                const name =
                    (opt[0].length === 1
                        ? this._optionsShort[opt[0]]
                        : opt[0]) || opt[0];
                if (opt.length === 1) {
                    options[name] = true;
                } else {
                    options[name] = opt[1];
                }
            } else {
                args.push(str);
            }
        });

        // console.log(args, options);

        const result = await this._actFunction(args, {});
        // const isTemp = options.public ? false : true;
        const isTemp = false;

        if (typeof result === 'string') {
            return {
                type: 9,
                content: result,
                _is_temp: isTemp,
            };
        }

        if (typeof result === 'object' && result.type === 'card') {
            return {
                type: 10,
                content: JSON.stringify([result]),
                _is_temp: isTemp,
            };
        }

        result._is_temp = isTemp;
        return result;
    }

    description(desc: string): Command {
        this._desc = desc;
        return this;
    }

    example(ex: string): Command {
        this._examples.push(ex);
        return this;
    }

    argument(arg: string, desc?: string): Command {
        this._args.push(arg);
        return this;
    }

    option(opt: string, desc?: string): Command {
        const short: string[] = [];
        let full: string;

        opt.split(',')
            .map((s) => s.trim().replace(/^([-]+)/g, ''))
            .forEach((s) => {
                if (/^.{1}$/.test(s)) {
                    short.push(s);
                } else {
                    full = s;
                }
            });

        short.forEach((s) => {
            this._optionsShort[s] = full;
        });

        return this;
    }

    action(cmdAction: CommandAction): Command {
        this._actFunction = cmdAction;
        return this;
    }

    help(help: string | false): Command {
        this._helpMessage = help;
        return this;
    }

    getHelp(): string {
        if (this._helpMessage === false) return '';
        if (!this._helpMessage)
            this._helpMessage = `${this._desc}\n     /${
                this._cmd
            } ${this._args.join(' ')}\n  例 ${this._examples.join('\n     ')}`;
        return this._helpMessage;
    }
}
