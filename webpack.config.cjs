const path = require('path');
const { spawn } = require('child_process');
const debug = require('debug')('Webpack');

const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

debug.enabled = true;
debug.useColors = true;
debug.color = 12;

module.exports = () => {
    /** 当前是否是开发环境 */
    const isEnvDevelopment = process.env.WEBPACK_BUILD_ENV === 'dev';
    // const isEnvDevelopment = true;
    /** 当前是否是 Serverless 模式 */
    const isEnvServerless = process.env.WEBPACK_BUILD_ENV === 'serverless';
    /** 打包结果路径 */
    const dist = path.resolve(
        __dirname,
        isEnvServerless ? 'dist-serverless' : 'dist',
    );

    const config = {
        // mode: isEnvDevelopment ? 'development' : 'production',
        mode: 'development',
        devtool: isEnvDevelopment ? 'cheap-module-source-map' : 'source-map',
        // target: isEnvDevelopment ? 'async-node' : 'node20',
        target: 'async-node',
        watch: isEnvDevelopment ? true : false,
        output: {
            filename: '[name].cjs',
            path: dist,
        },
        plugins: [],
        entry: {
            app: [path.resolve(__dirname, 'src/main.ts')],
        },
        module: {
            rules: [
                {
                    test: /\.(js|mjs|cjs|ts)$/,
                    use: {
                        loader: 'babel-loader',
                    },
                },
            ],
        },
        optimization: {
            splitChunks: false,
            removeAvailableModules: false,
            mergeDuplicateChunks: false,
            concatenateModules: false,
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, 'src/'),
            },
            modules: ['__modules', 'node_modules'],
            extensions: ['.js', '.ts', '.mjs', '.cjs', '.json'],
        },
        stats: {
            preset: 'minimal',
            // copied from `'minimal'`
            all: false,
            modules: false,
            // maxModules: 0,
            errors: true,
            warnings: false,
            // our additional options
            moduleTrace: true,
            errorDetails: true,
            performance: false,
        },
        performance: {
            maxEntrypointSize: 100 * 1024 * 1024,
            maxAssetSize: 100 * 1024 * 1024,
        },
    };

    if (!isEnvDevelopment) {
        config.plugins.push(new CleanWebpackPlugin());
        config.plugins.push(
            new CopyPlugin({
                patterns: [path.resolve(__dirname, './build-copy')],
            }),
        );
    } else {
        let child;
        // let launched = false;

        config.plugins.push({
            apply: (compiler) => {
                compiler.hooks.watchRun.tap(
                    'ApiServerPlugin',
                    (compilation) => {
                        // console.log('__watchRun');
                        if (child) {
                            console.log(' \n');
                            debug(
                                'Detected file change. Re-building & Re-launching app...',
                            );
                            child.kill();
                            child = undefined;
                        }
                    },
                );
                compiler.hooks.afterEmit.tap(
                    'ApiServerPlugin',
                    (compilation) => {
                        // console.log('__afterEmit');
                        if (child) return;

                        debug('Build completed. Launching app...');
                        console.log(' ');
                        // launched = true;

                        // console.log('\n\n');

                        child = spawn(
                            'node',
                            [
                                '--inspect=127.0.0.1:9230',
                                path.resolve(dist, 'app.cjs'),
                            ],
                            {
                                stdio: 'inherit',
                            },
                        );
                        // child.on('close', (code) => {
                        //     console.log(
                        //         `child process exited with code ${code}`
                        //     );
                        // });
                    },
                );
            },
        });
    }

    // console.log(config);

    return config;
};
