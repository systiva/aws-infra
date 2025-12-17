const pino = require('pino');
const config = require('./config');

const logger = pino({
    level: (config.LOG_LEVEL || 'info').toLowerCase(), // Ensure lowercase
    transport: config.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    } : undefined,
    formatters: {
        level: (label) => {
            return { level: label };
        }
    },
    base: {
        service: 'oms-service',
        env: config.NODE_ENV
    }
});

module.exports = logger;
