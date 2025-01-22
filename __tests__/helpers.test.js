import { expect, test } from 'vitest';

import isStringUrlOnly from '../src/helpers/is-string-url-only';
import transformStringToKMarkdown from '../src/helpers/transform-string-to-kmarkdown';

test('isStringUrlOnly()', async () => {
    expect(isStringUrlOnly('https://www.1.com')).toBe(true);
    expect(isStringUrlOnly('https://a-z.1.com')).toBe(true);
    expect(isStringUrlOnly('https://1.com')).toBe(true);
    expect(isStringUrlOnly('http://1.com')).toBe(true);
    expect(isStringUrlOnly('www.1.com')).toBe(true);

    expect(isStringUrlOnly('1.com')).toBe(false);
    expect(isStringUrlOnly('1')).toBe(false);
    expect(isStringUrlOnly('a-z.1.com')).toBe(false);
    expect(isStringUrlOnly('-z.1.com')).toBe(false);
    expect(isStringUrlOnly(' 1.com ')).toBe(false);
    expect(isStringUrlOnly('(1.com)')).toBe(false);

    expect(isStringUrlOnly('[↧](https://marticliment.com/unigetui/)')).toBe(
        true,
    );
    expect(isStringUrlOnly('[↧](https://www.marticliment.com/unigetui/)')).toBe(
        true,
    );
    expect(
        isStringUrlOnly(
            '[↧](https://www.marticliment.com/unigetui/)[↧](https://www.marticliment.com/unigetui/)',
        ),
    ).toBe(true);
    expect(
        isStringUrlOnly(
            '[↧](https://www.marticliment.com/unigetui/) [↧](https://www.marticliment.com/unigetui/)',
        ),
    ).toBe(true);
    expect(
        isStringUrlOnly('[↧](https://www.marticliment.com/unigetui/)a'),
    ).toBe(false);
    expect(
        isStringUrlOnly('[↧](https://www.marticliment.com/unigetui/) a'),
    ).toBe(false);
    expect(
        isStringUrlOnly(
            '[↧](https://www.marticliment.com/unigetui/) a[↧](https://www.marticliment.com/unigetui/)',
        ),
    ).toBe(false);
});

test('transformStringToKMarkdown()', async () => {
    expect(transformStringToKMarkdown('http://lnk.to/LACM-24541c')).toBe(
        `[http://lnk.to/LACM-24541c](http://lnk.to/LACM-24541c)`,
    );
    expect(transformStringToKMarkdown('(http://lnk.to/LACM-24541c)')).toBe(
        `(http://lnk.to/LACM-24541c)`,
    );
    expect(transformStringToKMarkdown('( http://lnk.to/LACM-24541c)')).toBe(
        `( [http://lnk.to/LACM-24541c)](http://lnk.to/LACM-24541c))`,
    );
    expect(transformStringToKMarkdown('💿http://lnk.to/LACM-24541c')).toBe(
        `💿[http://lnk.to/LACM-24541c](http://lnk.to/LACM-24541c)`,
    );
    expect(
        transformStringToKMarkdown(`💿http://lnk.to/LACM-24541c
🎶http://lnk.to/LACM-24541s`),
    ).toBe(
        `💿[http://lnk.to/LACM-24541c](http://lnk.to/LACM-24541c)
🎶[http://lnk.to/LACM-24541s](http://lnk.to/LACM-24541s)`,
    );
});
