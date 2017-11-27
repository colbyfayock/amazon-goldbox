const serverless = require('serverless-http');
const express = require('express');
const app = express();

const goldbox = require('./goldbox').goldbox;

/**
 * /goldbox
 * @description Grabs the RSS feed from Amazon and dumps
 *     the content into the specified s3 bucket
 */

app.get('/goldbox', function(req, res) {

    // Trigger the goldbox function with a callback
    // to give some kind of context to the response

    goldbox(function(data) {
        res.send(data);
    });

});

module.exports.handler = serverless(app);