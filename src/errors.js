
/**
 * Peerio custom error types and error handling helpers
 * @module errors
 */

/* CUSTOM ERROR TEMPLATE
function CustomError(message, nestedError, otherData) {
  var error = Error.call(this, message);
  this.name = 'CustomError';
  this.message = error.message;
  this.stack = error.stack;
  this.nestedError = nestedError;
  this.otherData = otherData;
}

CustomError.prototype = Object.create(Error.prototype);
CustomError.prototype.constructor = CustomError;
*/

/**
 * Use this helper to resolve returning error value.
 * If you:
 * - have an error result from catch() or reject()
 * - don't know what exactly that result is, Error, string, undefined or something else
 * - don't need custom errors just want to generate meaningful Error object
 * then call normalize and pass the result you've got together with fallback message
 * that will be wrapped in Error object and returned in case the result wasn't instance of Error
 */
module.exports.normalize = function(error, failoverMessage) {
    if (error instanceof Error) return error;

    if (failoverMessage) return new Error(failoverMessage);

    try {
        const message = typeof error === 'string' ? error : JSON.stringify(error);
        return new Error(message);
    } catch (e) {
        return new Error('unknown error');
    }
};

/**
 * helper function to create custom errors with less code.
 * It's useful when your custom error only expects to have an optional `message` and `data` object arguments.
 * @param {string} name - custom error name, should match the class name you will use for the error
 * @param {string} msg - default message for the error
 */
function getGenericCustomError(name, msg) {
    const err = function(message, data) {
        const error = Error.call(this, message || msg);
        this.name = name;
        this.message = error.message || '';
        this.stack = error.stack;
        this.data = data;
    };

    err.prototype = Object.create(Error.prototype);
    err.prototype.constructor = err;
    return err;
}
module.exports.getGenericCustomError = getGenericCustomError;
// -- Custom Errors ----------------------------------------------------------------------------------------------
module.exports.DecryptionError = getGenericCustomError('DecryptionError');
module.exports.EncryptionError = getGenericCustomError('EncryptionError');
module.exports.AntiTamperError = getGenericCustomError('AntiTamperError');
module.exports.AbstractCallError = getGenericCustomError('AbstractCallError',
                                                         'Abstract function call. Override this function.');
module.exports.NoPasscodeFoundError = getGenericCustomError('NoPasscodeFoundError',
                                                         'No passcode found.');
module.exports.DisconnectedError = getGenericCustomError('DisconnectedError');
// -- Server Errors ----------------------------------------------------------------------------------------------
const serverErrorCodes = {
    notFound: 404,
    malformedRequest: 406,
    apiVersionError: 410,
    incorrectPublicKey: 411,
    quotaExceeded: 413,
    authError: 423,
    twoFAAuthRequired: 424,
    accountThrottled: 425,
    accountBlacklisted: 426,
    accountMigrationRequired: 434,
    captchaPending: 435,
    accountClosed: 488,
    incorrectTimestamp: 442,
    genericServerError: 400
};
// reverse map
const serverErrorMap = {};
Object.keys(serverErrorCodes).forEach((key) => {
    serverErrorMap[serverErrorCodes[key]] = key;
});

function ServerError(code, msg) {
    const type = serverErrorMap[code] || 'Unknown server error';
    this.message = msg || type;
    const error = Error.call(this, this.message);
    this.name = `ServerError: ${code}: ${type}`;
    this.code = code;
    this.stack = error.stack;
}

ServerError.prototype = Object.create(Error.prototype);
ServerError.prototype.constructor = ServerError;
ServerError.codes = serverErrorCodes;

module.exports.ServerError = ServerError;
//----------------------------------------------------------------------------------------------------------------------
