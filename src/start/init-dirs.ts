import fs from 'fs-extra';
import { debugInitializing } from '../debug';

// cacheDir
// logDir
import { cacheDir, logDir } from '../../app.config';

async function initDirs(): Promise<undefined> {
    debugInitializing('Initializing directories...');

    await fs.ensureDir(cacheDir);
    await fs.ensureDir(logDir);

    debugInitializing('Completed');
    return undefined;
}

export default initDirs;
