import winston from 'winston';
import 'winston-daily-rotate-file';

import { logDir } from '../app.config';

// transport.on('rotate', function (oldFilename, newFilename) {
//     do something fun
// });

const transports = ['error', 'warn', 'notice', 'info', 'http', undefined].map(
    (level) =>
        new winston.transports.DailyRotateFile({
            level,
            filename: `${level || 'combined'}.%DATE%.log`,
            dirname: logDir,
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxFiles: '14d',
            utc: true,
        })
);

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        // winston.format.label({ label: 'right meow!' }),
        winston.format.timestamp(),
        winston.format.prettyPrint()
    ),
    defaultMeta: { service: 'fly-dbh-kook-bot' },
    transports,
});

export default logger;

// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logError(err: Record<string, any>) {
    const loggerData: Record<string, unknown> = {
        type: 'ERROR',
        error: err,
        message: err.message,
    };

    // console.log('\n');
    // console.error(err);

    if (err.response) {
        loggerData.type = 'AXIOS_ERROR';
        loggerData.response = err.response;
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        // console.log(err.response?.data);
        // console.log(err.response?.status);
        // console.log(err.response?.headers);
    }
    if (err.request) {
        loggerData.type = 'AXIOS_ERROR';
        loggerData.request = err.request;
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        // console.log(err.request);
    }
    if (err.config) {
        loggerData.config = err.config;
        // console.log(err.config);
    }

    logger.error(loggerData);
}
