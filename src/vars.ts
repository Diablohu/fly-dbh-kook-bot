/**
 * 公开回应的频道ID
 * - 在其他频道回应时，会以隐藏方式进行回应，并删除问话
 */
export const kookPublicResponseChannelIDs = [
    `6061361713354559`,
    `6086801551312186`, // Playground Channel
];

/*
https?://(?:www\\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\\.[\\S]{2,}
https?://(?:www\\.|(?!www))[a-zA-Z0-9]+\\.[\\S]{2,}
www\\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\\.[\\S]{2,}
www\\.[a-zA-Z0-9]+\\.[\\S]{2,}
*/
/**
 * 用以判断字符串是否是 URL 的正则表达式 string
 * - 可直接使用 `new RegExp()` 来生成正则表达式
 */
export const regexStringUrlPattern = `(${[
    `https?://(?:www\\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]`,
    `https?://(?:www\\.|(?!www))[a-zA-Z0-9]+`,
    `www\\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]`,
    `www\\.[a-zA-Z0-9]+`,
]
    .map((s) => `${s}\\.[\\S]{2,}`)
    // .map((s) => `${s}\\.[a-zA-Z]{2,}`)
    .join('|')})`;
