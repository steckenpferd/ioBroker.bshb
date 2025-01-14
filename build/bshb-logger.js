"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * This class implements the logger of bosch-smart-home-bridge and forward it to iobroker
 *
 * @author Christopher Holomek
 * @since 27.09.2019
 */
class BshbLogger {
    constructor(adapter) {
        this.adapter = adapter;
    }
    fine(message, ...optionalParams) {
        // We ignore fine so far. Because it is very detailed
        this.log('silly', message, optionalParams);
    }
    debug(message, ...optionalParams) {
        this.log('debug', message, optionalParams);
    }
    info(message, ...optionalParams) {
        this.log('info', message, optionalParams);
    }
    error(message, ...optionalParams) {
        this.log('error', message, optionalParams);
    }
    warn(message, ...optionalParams) {
        this.log('warn', message, optionalParams);
    }
    log(msgType, message, ...optionalParams) {
        if (message) {
            if (optionalParams[0].length > 0) {
                let concatMessage = message;
                optionalParams.forEach(value => {
                    if (typeof value === 'object') {
                        concatMessage += ' - ' + JSON.stringify(value);
                    }
                    else {
                        concatMessage += ' - ' + value;
                    }
                });
                this.adapter.log[msgType](concatMessage);
            }
            else {
                this.adapter.log[msgType](message);
            }
        }
        else {
            if (optionalParams[0].length > 0) {
                let concatMessage = '';
                optionalParams.forEach(value => {
                    if (typeof value === 'object') {
                        concatMessage += ' - ' + JSON.stringify(value);
                    }
                    else {
                        concatMessage += ' - ' + value;
                    }
                });
                this.adapter.log[msgType](concatMessage);
            }
            else {
                this.adapter.log[msgType]('');
            }
        }
    }
}
exports.BshbLogger = BshbLogger;
