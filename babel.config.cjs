module.exports = function (api) {
    api.cache(true);

    return {
        presets: [
            [
                '@babel/preset-typescript',
                {
                    modules: false,
                },
            ],
        ],
        compact: 'auto',
        plugins: [
            // transform

            // proposal
            ['@babel/plugin-proposal-decorators', { legacy: true }],
            '@babel/plugin-proposal-class-properties',
            '@babel/plugin-proposal-nullish-coalescing-operator',
            '@babel/plugin-proposal-optional-chaining',

            // syntax
        ],
    };
};
