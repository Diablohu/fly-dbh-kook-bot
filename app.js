import { spawn } from 'node:child_process';
import webpack from 'webpack';
import config from './webpack.config.cjs';

/**
 * 针对 Serverless 服务的入口文件
 * 1. 通过 Webpack 打包 `production` 环境的代码
 * 2. 运行 `dist-serverless/main.cjs`
 */
async function main() {
    process.env.WEBPACK_BUILD_ENV = 'serverless';

    const compiler = webpack(config());
    compiler.run((err, stats) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(
            stats.toString({
                colors: true,
                modules: false,
                children: false,
                chunks: false,
                chunkModules: false,
                entrypoints: false,
            }),
        );

        const child = spawn('node', ['dist-serverless/main.cjs'], {
            stdio: 'inherit',
        });
        child.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });
    });
}

main().catch((err) => {
    console.error(err);
});
