/**
 * Kenny
 * @description Log wrapper
 */

function Kenny() {
    this.service = null;
    this.function = null;
}

/**
 * Set
 * @description Sets log intance variables, useful for namespacing
 */

Kenny.prototype.set = function(settings) {

    if ( typeof settings === 'undefined' ) settings = {};

    this.service = settings.service;
    this.function = settings.function;

}

/**
 * Message
 * @description Creates the message based on instance variables
 *     and the passed in message
 */

Kenny.prototype.message = function(message) {

    var log = [];

    if ( this.service ) log.push(this.service);
    if ( this.function ) log.push(this.function);
    if ( message ) log.push(message);

    return log.join(' | ');

}

/**
 * Log
 * @description Console.log with the value constructed from this.message
 */

Kenny.prototype.log = function(message) {

    console.log(this.message(message));

    return this.message(message);

};

module.exports = new Kenny;