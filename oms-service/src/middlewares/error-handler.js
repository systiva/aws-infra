const logger = require('../../logger');

/**
 * Global error handler middleware
 * Handles all errors and sends appropriate responses
 */
const errorHandler = (err, req, res, next) => {
    logger.error('Error occurred', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        userId: req.user?.userId,
        tenantId: req.tenantId
    });
    
    // DynamoDB errors
    if (err.name === 'DocumentNotFoundError') {
        return res.status(404).json({
            error: 'Not Found',
            message: 'Resource not found'
        });
    }
    
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            message: err.message
        });
    }
    
    // AWS SDK errors
    if (err.code === 'AccessDenied') {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied'
        });
    }
    
    if (err.code === 'ResourceNotFoundException') {
        return res.status(404).json({
            error: 'Not Found',
            message: 'Resource not found'
        });
    }
    
    // Default error response
    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || 'Internal server error';
    
    res.status(statusCode).json({
        error: err.name || 'Error',
        message: message
    });
};

/**
 * 404 handler for undefined routes
 */
const notFoundHandler = (req, res) => {
    logger.warn('Route not found', {
        path: req.path,
        method: req.method
    });
    
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
    });
};

module.exports = {
    errorHandler,
    notFoundHandler
};
