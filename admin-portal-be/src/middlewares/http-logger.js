const pino = require('pino');
const pinoHttp = require('pino-http');

const logger = pinoHttp({
  logger: pino(),
  level: process.env.LOG_LEVEL || 'debug',
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        headers: req.headers,
        query: req.query,
        params: req.params,
        body: req.raw.body,
      };
    },
    res: (res) => {
      return {
        statusCode: res.statusCode,
        // headers: res.headers, // Uncomment this line to log headers
      };
    },
  },
});

module.exports = logger;
