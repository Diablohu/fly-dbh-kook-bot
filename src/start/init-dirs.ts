import fs from 'fs-extra';

// cacheDir
// logDir
import { cacheDir, logDir } from '../../app.config';

async function initDirs(): Promise<undefined> {
    await fs.ensureDir(cacheDir);
    await fs.ensureDir(logDir);

    return undefined;
}

export default initDirs;
