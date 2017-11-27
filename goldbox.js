const request = require('request');
const aws = require('aws-sdk');
const s3 = new aws.S3();

const AmazonRSS = require('./lib/amazon-rss');

/**
 * logHandler
 * @description Manages console logging and response callbacks
 */

function logHandler(options) {

    console.log(`${options.namespace}: ${options.message}`);
            
    if ( typeof options.callback === 'function' ) {
        options.callback({
            statusCode: options.status_code,
            message: options.message
        });
    }

}

/**
 * goldbox
 * @description Requests the RSS feed specified, cleans it up
 *     and dumps it into an S3 bucket
 */

module.exports.goldbox = function(event, context) {

    logHandler({
        namespace: process.env.service,
        message: `RSS Get - ${process.env.rss_feed}`
    });

    // Make a request to the RSS feed per the config

    request(process.env.rss_feed, {}, (error, response, body) => {
        
        if ( error ) {
            logHandler({
                namespace: process.env.service,
                callback: event,
                status_code: 500,
                message: `RSS Error - ${JSON.stringify(error)}`
            });
        }

        logHandler({
            namespace: process.env.service,
            message: `RSS Success - ${process.env.rss_feed}`
        });

        // Once we successfully have the feed, convert it to json
        // for easier JSland usage

        AmazonRSS.feedToJson(body, (json_error, json_results) => {

            // Clean up the data and personalize it
            
            var feed = AmazonRSS.parseRawFeed(json_results, {
                affiliate_id: process.env.affiliate_id
            });

            // Sort the feed, this sorts by the published date of the item

            feed = AmazonRSS.sortFeed(feed);

            logHandler({
                namespace: process.env.service,
                message: `S3 Put - ${process.env.bucket}/${process.env.path}`
            });

            // Once we have the desired feed, dump it into an S3 bucket

            s3.putObject({
                Bucket: process.env.bucket,
                Key: process.env.path,
                Body: JSON.stringify(feed),
            }, function(s3_error, s3_data) {

                if ( s3_error ) {
                    logHandler({
                        namespace: process.env.service,
                        callback: event,
                        status_code: 500,
                        message: `S3 Error - ${JSON.stringify(s3_error)}`
                    });
                } else {                    
                    logHandler({
                        namespace: process.env.service,
                        callback: event,
                        status_code: 200,
                        message: `S3 Success - ${JSON.stringify(s3_data)}`
                    });
                }

            });

        });

    });
    
}