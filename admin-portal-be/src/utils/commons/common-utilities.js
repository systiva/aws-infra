const Constants = require('../../../constant');
const InternalError = require('../error/internal-error');
const Logger = require('../../../logger');
const config = require('../../../config');
const axios = require('axios');
const qs = require('qs');

class CommonUtilities {
  static getRes(statusCode, msg, data) {
    let res = {
      status: statusCode,
      json: {
        msg,
        data,
      },
    };
    const successStatusCodeList = [
      Constants.HTTP_STATUS.OK,
      Constants.HTTP_STATUS.CREATED,
    ];
    if (successStatusCodeList.includes(statusCode)) {
      res.json.result = Constants.RESPONSE_RESULT.SUCCESS;
    } else {
      res.json.result = Constants.RESPONSE_RESULT.FAILED;
    }
    return res;
  }

}

module.exports = CommonUtilities;
