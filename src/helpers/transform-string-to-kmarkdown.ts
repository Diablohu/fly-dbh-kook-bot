import { regexStringUrlPattern } from '../vars';

function transformStringToKMarkdown(input: string): string {
    return input.replace(
        new RegExp(`(.?)${regexStringUrlPattern}(.?)`, 'g'),
        (match, p1, p2, ...args) => {
            // console.log(123, { match, p1, p2, args, p3: args.at(-3) });
            // 如果匹配前后是空格，无视
            if (p1 === '(' && args.at(-3) === ')') return match;
            if (p1 === '(' && p2.slice(-1) === ')') return match;
            return `${p1}[${p2}](${p2})${args.at(-3)}`;
        },
    );
}

export default transformStringToKMarkdown;
