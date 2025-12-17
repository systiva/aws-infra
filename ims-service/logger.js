// Logger utility for IMS Service
const config = require('./config');

class Logger {
  constructor() {
    this.level = config.LOG_LEVEL.toLowerCase();
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      service: 'ims-service',
      ...this.safeMetaClone(meta)
    };

    // Add request ID if available in Lambda context
    if (global.lambdaContext && global.lambdaContext.awsRequestId) {
      logEntry.requestId = global.lambdaContext.awsRequestId;
    }

    return JSON.stringify(logEntry);
  }

  safeMetaClone(meta) {
    const seen = new WeakSet();
    return JSON.parse(JSON.stringify(meta, (key, val) => {
      if (val != null && typeof val === "object") {
        if (seen.has(val)) {
          return "[Circular]";
        }
        seen.add(val);
      }
      return val;
    }));
  }

  error(message, meta = {}) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta));
    }
  }

  warn(message, meta = {}) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  info(message, meta = {}) {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, meta));
    }
  }

  debug(message, meta = {}) {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  // Request logging middleware
  requestLogger() {
    return (req, res, next) => {
      const start = Date.now();
      
      if (config.LOG_REQUESTS) {
        this.info('Incoming request', {
          method: req.method,
          url: req.url,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      }

      // Log response when it finishes
      const originalSend = res.send;
      res.send = function(data) {
        const duration = Date.now() - start;
        
        if (config.LOG_REQUESTS) {
          const logger = new Logger();
          logger.info('Request completed', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`
          });
        }

        return originalSend.call(this, data);
      };

      next();
    };
  }
}

module.exports = new Logger();