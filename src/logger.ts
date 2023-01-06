import path from 'path';
import winston from 'winston';

import { logDir } from '../app.config';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        // winston.format.label({ label: 'right meow!' }),
        winston.format.timestamp(),
        winston.format.prettyPrint()
    ),
    defaultMeta: { service: 'fly-dbh-discord-bot' },
    transports: [
        new winston.transports.File({
            filename: path.resolve(logDir, 'error.log'),
            level: 'error',
        }),
        new winston.transports.File({
            filename: path.resolve(logDir, 'warn.log'),
            level: 'warn',
        }),
        new winston.transports.File({
            filename: path.resolve(logDir, 'info.log'),
            level: 'info',
        }),
        new winston.transports.File({
            filename: path.resolve(logDir, 'combined.log'),
        }),
    ],
});

export default logger;
