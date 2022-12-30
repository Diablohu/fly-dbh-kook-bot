const path = require('path');
const { spawn } = require('child_process');
// const debug = require('debug')('webpack');

const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = () => {
    /** 当前是否是开发环境 */
    const isEnvDevelopment = process.env.WEBPACK_BUILD_ENV === 'dev';
    /** 打包结果路径 */
    const dist = path.resolve(__dirname, 'dist');

    const config = {
        mode: 'development',
        devtool: isEnvDevelopment ? 'cheap-module-source-map' : 'source-map',
        target: 'async-node',
        watch: isEnvDevelopment ? true : false,
        output: {
            filename: '[name].cjs',
            path: dist,
        },
        plugins: [],
        entry: {
            main: [
                path.resolve(__dirname, 'src/polyfill.cjs'),
                path.resolve(__dirname, 'src/main.ts'),
            ],
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
                            // debug('server reloading...');
                            child.kill();
                            child = undefined;
                        }
                    }
                );
                compiler.hooks.afterEmit.tap(
                    'ApiServerPlugin',
                    (compilation) => {
                        // console.log('__afterEmit');
                        if (child) return;

                        // debug(
                        //     launched ? 'server started!' : 'server reloaded!'
                        // );
                        // launched = true;

                        // console.log('\n\n');

                        child = spawn(
                            'node',
                            [path.resolve(dist, 'main.cjs')],
                            {
                                stdio: 'inherit',
                            }
                        );
                        // child.on('close', (code) => {
                        //     console.log(
                        //         `child process exited with code ${code}`
                        //     );
                        // });
                    }
                );
            },
        });
    }

    // console.log(config);

    return config;
};
