import { regexStringUrlPattern } from '../vars';

function isStringUrlOnly(str: string): boolean {
    return (
        new RegExp(`^${regexStringUrlPattern}$`).test(str) ||
        new RegExp(`^(\\[↧\\]\\(${regexStringUrlPattern}\\)\\s*)+$`).test(str)
    );
}

export default isStringUrlOnly;

/*
new RegExp(`^(\\[↧\\]\\(.+?\\))$`)
\1+
*/
