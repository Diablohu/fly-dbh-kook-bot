export const port = process.env.WEBPACK_BUILD_ENV === 'dev' ? 9000 : 8080;
export const newsChannelID = '6086801551312186';
export const cacheDir =
    process.env.WEBPACK_BUILD_ENV === 'dev' ? '.cache' : '/.cache';
export const logDir =
    process.env.WEBPACK_BUILD_ENV === 'dev' ? '.logs' : '/.logs';
