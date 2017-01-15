/**
 * Configuration module.
 * Exists just to collect most of the app configuration aspects in one place.
 * ! Is not supposed be edited at runtime !
 * @module config
 */

const TinyDb = require('./db/tiny-db');

const config = new class {
    // -- development only
    debug = {
        trafficReportInterval: 60000,
        socketLogEnabled: false
    };
    //-------------------
    termsUrl = 'https://github.com/PeerioTechnologies/peerio-documentation/blob/master/Terms_of_Use.md';
    supportUrl = 'https://peerio.zendesk.com';

    socketServerUrl = 'wss://';
    upload = {
        chunkSize: 1024 * 512,
        maxReadQueue: 2, // max amount of chunks to pre-buffer for upload
        maxSendQueue: 2, // max amount of chunks to pre-encrypt for sending
        maxParallelUploadingChunks: 2 // max amount of uploaded chunks waiting for server response
    };

    // -- client-specific implementations
    FileStream = null;
    set TinyDb(engine) {
        TinyDb.setEngine(engine);
    }
}();

// ICEBEAR_TEST_ENV is a constant replacement set by webpack
// this is only for running icebear unit tests
if (typeof (ICEBEAR_TEST_ENV) !== 'undefined') {
    config.socketServerUrl = ICEBEAR_TEST_ENV;
}

module.exports = config;
