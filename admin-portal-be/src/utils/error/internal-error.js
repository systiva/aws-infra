'use strict';

class InternalError extends Error {
  constructor(msg, err) {
    super(msg);
    this.name = this.constructor.name;
    this.err = err;
    this.msg = msg;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = InternalError;
