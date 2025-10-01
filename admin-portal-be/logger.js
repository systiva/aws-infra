const pino = require('pino');

module.exports = pino({
  level: process.env.LOG_LEVEL || 'debug',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label.toUpperCase() };
    },
    bindings(bindings) {
      return {};
    },
  },
});
