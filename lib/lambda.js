/**
 * respondToSuccess
 * @description
 */

function respondToSuccess({label, data, event, message = 'Ok'}) {

  console.log(`${label} - Success: ${message};`);

  if ( typeof event === 'function' ) {

    event({
      statusCode: 200,
      message: `${message}`
    });

  }

}

module.exports.respondToSuccess = respondToSuccess;


/**
 * respondToError
 * @description
 */

function respondToError({label, data, event, message = 'Unknown error.'}) {

  console.log(`${label} - Error: ${message}; ${data}`);

  if ( typeof event === 'function' ) {

    event({
      statusCode: 500,
      message: `${message}`
    });

  }

}

module.exports.respondToError = respondToError;