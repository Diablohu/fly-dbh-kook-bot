import metar, { helpMessage as metarMessage } from './metar';

async function commands(command: string): Promise<string> {
    command = command.replace(/^\//, '');
    const [type, ...args] = command.split(' ');

    switch (type.toLowerCase()) {
        case 'help': {
            return [metarMessage].map((msg) => `\`${msg}\``).join(`\n`);
        }
        case 'metar': {
            return await metar(args[0]);
        }
    }

    // 未知命令
    return '未知命令。输入 `/help` 可查看命令帮助。';
}

export default commands;
