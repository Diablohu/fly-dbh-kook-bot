/* eslint-disable no-console */
/**
 * 发布项目
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { cwd } from 'process';
import md5 from 'md5';
import { spawn } from 'koot-cli-kit';
import Listr from 'listr';

const {
    git,
    branch,
    directory = '',
    buildCmd,
    dist,
    after,
} = {
    /** 目标项目的 Git 仓库地址 */
    git: 'git@github.com:Diablohu/fly-dbh-kook-bot.git',

    /** 目标项目的 Git 仓库分支 */
    branch: 'dist',

    /**
     * Git 仓库中的目标目录
     * - 如果没有提供，表示根目录
     */
    directory: '',

    /**
     * 本项目的打包命令
     * - 如果没有提供，表明无需打包，直接发布
     */
    buildCmd: 'npm run build',

    /** 本项目的打包结果目录 */
    dist: 'dist',

    /** 流程结束后执行 */
    after() {
        // eslint-disable-next-line no-console
        console.log(
            `\n发布完成 ${new Intl.DateTimeFormat('zh-CN', {
                dateStyle: 'long',
                timeStyle: 'short',
                timeZone: 'Asia/Shanghai',
            }).format(Date.now())}\n\n`
        );
    },
};

async function publish() {
    if (!git) throw new Error('MISSING_PARAMETER: `git`');
    if (!buildCmd) throw new Error('MISSING_PARAMETER: `buildCmd`');
    if (!dist) throw new Error('MISSING_PARAMETER: `dist`');

    const md5git = md5(git);
    const homeDirectory = os.homedir();
    const workingDirectory = path.resolve(
        homeDirectory,
        '.diablohu/publish',
        md5git
    );
    const destDirectory = path.resolve(workingDirectory, directory);
    const distDirectory = path.resolve(cwd(), dist);

    await new Listr(
        [
            {
                title: '事前准备', // 检查 `workingDirectory`
                task: async function () {
                    // console.log(
                    //     `git clone ${git} ${md5git} --depth 1` +
                    //         (!branch ? '' : ` --branch ${branch}`)
                    // );
                    // 如果存在且为目标 git 仓库，跳过下述步骤
                    if (
                        !fs.existsSync(workingDirectory) ||
                        !fs.existsSync(path.resolve(workingDirectory, '.git'))
                    ) {
                        const parentDirectory = path.resolve(
                            workingDirectory,
                            '..'
                        );
                        await fs.remove(workingDirectory);
                        await fs.ensureDir(parentDirectory);
                        await spawn(
                            `git clone ${git} ${md5git} --depth 1` +
                                (!branch ? '' : ` --branch ${branch}`),
                            {
                                stdio: 'ignore',
                                // stdio: 'inherit',
                                cwd: parentDirectory,
                            }
                        ).catch((err) => {
                            throw err;
                        });
                    }

                    for (const cmd of [
                        // 确保分支
                        !branch ? undefined : `git checkout ${branch}`,

                        // 确保 `workingDirectory` 为最新版本
                        'git pull',

                        // 清理
                        'git reset --hard',
                    ].filter((v) => !!v)) {
                        await spawn(cmd, {
                            stdio: 'ignore',
                            cwd: workingDirectory,
                        }).catch((err) => {
                            throw err;
                        });
                    }
                },
            },
            {
                title: '打包',
                task: async function () {
                    if (!buildCmd) return;

                    await spawn(buildCmd, {
                        stdio: 'ignore',
                        cwd: cwd(),
                    }).catch((err) => {
                        throw err;
                    });
                },
            },
            {
                title: '复制文件', // 将结果复制到 `destDirectory`
                task: async function () {
                    await fs.ensureDir(destDirectory);
                    await spawn('git rm -rf .', {
                        stdio: 'ignore',
                        cwd: destDirectory,
                    }).catch((err) => {
                        throw err;
                    });
                    await fs.copy(distDirectory, destDirectory);
                },
            },
            {
                title: 'Git 提交', // Git 操作
                task: async function () {
                    const now = new Date();
                    const msg = `DIABLOHU_PUBLISH ${now.toLocaleString()}`;
                    const commands = ['git add .', `git commit -m "${msg}"`];

                    commands.push('git push');

                    for (const cmd of commands) {
                        await spawn(cmd, {
                            stdio: 'ignore',
                            cwd: workingDirectory,
                        }).catch((err) => {
                            throw err;
                        });
                    }
                },
            },
        ],
        { exitOnError: false }
    )
        .run()
        .catch((err) => {
            console.log('\n');
            console.error(err);
        });

    // console.log({
    //     homeDirectory,
    //     workingDirectory,
    //     destDirectory,
    //     distDirectory,
    // });

    if (typeof after === 'function') await after();
}

publish().catch(console.error);
