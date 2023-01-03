import fs from 'fs-extra';
import path from 'node:path';

import type { MessageSource } from '../types';

import { cacheDir } from '../app.config';
import upload from './upload';

// ============================================================================

const logos = {
    discord:
        'https://cdn.iconscout.com/icon/free/png-256/discord-3691244-3073764.png',
};

let cache: Record<string, string>;

export async function getSourceLogo(
    source: MessageSource
): Promise<string | undefined> {
    const cacheFile = path.resolve(cacheDir, 'logos.json');

    if (!cache) {
        cache = fs.existsSync(cacheFile)
            ? (fs.readJSONSync(cacheFile) as Record<MessageSource, string>)
            : {};
    }

    if (!!cache[source]) return cache[source];

    cache[source] = await upload(logos[source]);

    await fs.ensureDir(cacheDir);
    await fs.writeJSON(cacheFile, cache);
}
