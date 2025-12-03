const logger = require('../../logger');

/**
 * DynamoDB Error Handler
 * Standardizes error handling for DynamoDB operations
 */

/**
 * Handle DynamoDB errors and convert to standardized format
 * @param {Error} error - Original error
 * @param {string} operation - Operation being performed
 * @param {Object} context - Additional context
 * @returns {Error} Standardized error
 */
function handleDynamoDBError(error, operation, context = {}) {
    logger.error(`DynamoDB ${operation} error`, {
        error: error.message,
        code: error.code,
        name: error.name,
        operation,
        context,
        stack: error.stack
    });
    
    // Document not found
    if (error.name === 'DocumentNotFoundError' || error.code === 'ResourceNotFoundException') {
        const notFoundError = new Error('Resource not found');
        notFoundError.name = 'DocumentNotFoundError';
        notFoundError.statusCode = 404;
        return notFoundError;
    }
    
    // Validation error
    if (error.name === 'ValidationError' || error.code === 'ValidationException') {
        const validationError = new Error(error.message || 'Validation failed');
        validationError.name = 'ValidationError';
        validationError.statusCode = 400;
        return validationError;
    }
    
    // Conditional check failed
    if (error.code === 'ConditionalCheckFailedException') {
        const conditionalError = new Error('Resource already exists or condition not met');
        conditionalError.name = 'ConditionalCheckFailed';
        conditionalError.statusCode = 409;
        return conditionalError;
    }
    
    // Access denied
    if (error.code === 'AccessDeniedException') {
        const accessError = new Error('Access denied to DynamoDB resource');
        accessError.name = 'AccessDenied';
        accessError.statusCode = 403;
        return accessError;
    }
    
    // Throttling
    if (error.code === 'ProvisionedThroughputExceededException' || 
        error.code === 'ThrottlingException') {
        const throttleError = new Error('Request throttled. Please try again.');
        throttleError.name = 'Throttled';
        throttleError.statusCode = 429;
        return throttleError;
    }
    
    // Default: Internal server error
    const serverError = new Error(error.message || 'Database operation failed');
    serverError.name = 'DatabaseError';
    serverError.statusCode = 500;
    return serverError;
}

/**
 * Wrap async DynamoDB operation with error handling
 * @param {Function} operation - Async operation to execute
 * @param {string} operationName - Name of the operation for logging
 * @param {Object} context - Additional context
 * @returns {Promise} Result of operation
 */
async function wrapDynamoDBOperation(operation, operationName, context = {}) {
    try {
        return await operation();
    } catch (error) {
        throw handleDynamoDBError(error, operationName, context);
    }
}

module.exports = {
    handleDynamoDBError,
    wrapDynamoDBOperation
};
