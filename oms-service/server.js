const app = require('./app');
const logger = require('./logger');
const config = require('./config');

const PORT = config.PORT || 3002;

app.listen(PORT, () => {
    logger.info(`OMS Service started on port ${PORT}`);
    logger.info(`Environment: ${config.NODE_ENV}`);
    logger.info(`API Prefix: ${config.API_PREFIX}`);
});
