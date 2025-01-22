const isStringUrlOnly = require('../src/helpers/is-string-url-only');

describe('示例测试', () => {
    test('isStringUrlOnly()', async () => {
        expect(isStringUrlOnly('https://1.com')).toBe(false);
        expect(isStringUrlOnly('1.com')).toBe(false);
        expect(isStringUrlOnly('1')).toBe(false);
        expect(isStringUrlOnly('a-z.1.com')).toBe(true);
        expect(isStringUrlOnly('-z.1.com')).toBe(false);
        expect(isStringUrlOnly(' 1.com ')).toBe(false);
        expect(isStringUrlOnly('(1.com)')).toBe(false);
    });
});

/*

[↧](https://www.marticliment.com/unigetui/)

💿http://lnk.to/LACM-24541c
🎶http://lnk.to/LACM-24541s

*/
