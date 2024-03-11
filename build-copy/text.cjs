function prepareEnvKey(key) {
    if (!process.env[`${key}`]) {
        process.env[`${key}`] =
            process.env[`${key.toLowerCase()}`] ||
            (!!process.env[`${key}_FILE`] &&
            fs.existsSync(process.env[`${key}_FILE`] || '')
                ? fs.readFileSync(process.env[`${key}_FILE`] || '', 'utf-8')
                : '');
    }
}

function main() {
    console.log('test');

    prepareEnvKey('KOOK_TOKEN');
    prepareEnvKey('AVWX_TOKEN');

    console.log(process.env);
}

main();
