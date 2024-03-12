import createDebug from 'debug';

// const debugEnabled = process.env.WEBPACK_BUILD_ENV === 'dev'
const debugEnabled = true;

export const debugMain = createDebug('Main');
debugMain.enabled = debugEnabled;

export const debugInitializing = createDebug('Initializing');
// debugInitializing.color = '13';
debugInitializing.enabled = debugEnabled;

export const debugKoaServer = createDebug('Koa Server');
debugKoaServer.enabled = debugEnabled;

export const debugKookClient = createDebug('Kook Client');
debugKookClient.enabled = debugEnabled;
