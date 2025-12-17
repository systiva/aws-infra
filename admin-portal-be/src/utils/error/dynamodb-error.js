const InternalError = require('./internal-error');

class DynamoDBError {
  static handleRequestExecutionError(err) {
    if (!err) {
      throw new InternalError(
        'Unknown error, Encountered error object is null',
      );
    }
    if (!err.code) {
      throw new InternalError(`An exception occurred, investigate and configure retry strategy, Error:
                ${JSON.stringify(err)}`);
    }
    // handle DynamoDB errors based on error code
    switch (err.code) {
      case 'ConditionalCheckFailedException':
        throw new InternalError('The conditional request failed');
      case 'ItemCollectionSizeLimitExceededException':
        throw new InternalError(
          'An item collection exceeded the maximum allowed size',
        );
      case 'LimitExceededException':
        throw new InternalError(
          'A limit was exceeded, such as the maximum number of requests per second',
        );
      case 'ProvisionedThroughputExceededException':
        throw new InternalError(
          'Your request rate is too high. The AWS SDKs for DynamoDB automatically retry requests that receive this exception. Your request is eventually successful, unless your retry queue is too large to finish',
        );
      case 'ResourceNotFoundException':
        throw new InternalError(
          'The operation tried to access a nonexistent table or index',
        );
      case 'ResourceInUseException':
        throw new InternalError(
          'The operation conflicts with an existing resource',
        );
      case 'ServiceUnavailable':
        throw new InternalError('The service is currently unavailable');
      case 'ThrottlingException':
        throw new InternalError(
          'The request was denied due to request throttling',
        );
      case 'ValidationException':
        throw new InternalError('Your request has invalid input');
      case 'RequestLimitExceeded':
        throw new InternalError(
          'Throughput exceeds the current throughput limit for your account',
        );
      case 'AccessDeniedException':
        throw new InternalError('Access denied');
      case 'InternalServerError':
        throw new InternalError('An error occurred on the server side');
      default:
        throw new InternalError(`An exception occurred, investigate and configure retry strategy, Error:
                    ${JSON.stringify(err)}`);
    }
  }
}

module.exports = DynamoDBError;
