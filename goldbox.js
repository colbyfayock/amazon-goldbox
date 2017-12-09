const request = require('request');
const awssdk = require('aws-sdk');
const s3 = new awssdk.S3();

const AmazonRSS = require('./lib/amazon-rss');
const Util = require('./lib/util');
const Kenny = require('./lib/kenny');

/**
 * goldbox
 * @description Requests the RSS feed specified, cleans it up
 *     and dumps it into an S3 bucket
 */

module.exports.goldbox = function(event, context) {

    Kenny.set({
        service: process.env.service,
        function: 'goldbox'
    });

    Kenny.log(`RSS Get - ${process.env.rss_feed}`);

    // Make a request to the RSS feed per the config

    request(process.env.rss_feed, {}, (error, response, body) => {

        if ( error ) {
            Util.respond({
                callback: event,
                status_code: 500,
                message: Kenny.log(`RSS Error - ${JSON.stringify(error)}`)
            });
            return;
        }

        Kenny.log(`RSS Success - ${process.env.rss_feed}`);

        // Once we successfully have the feed, convert it to json
        // for easier JSland usage

        AmazonRSS.feedToJson(body, (json_error, json_results) => {

            // Clean up the data and personalize it

            var feed = AmazonRSS.parseRawFeed(json_results, {
                affiliate_id: process.env.affiliate_id
            });

            // Sort the feed, this sorts by the published date of the item

            feed = AmazonRSS.sortFeed(feed);

            Kenny.log(`S3 Put - ${process.env.bucket}/${process.env.goldbox_path}`);

            // Once we have the desired feed, dump it into an S3 bucket

            s3.putObject({
                Bucket: process.env.bucket,
                Key: process.env.goldbox_path,
                Body: JSON.stringify(feed),
            }, function(s3_error, s3_data) {

                if ( s3_error ) {
                    Util.respond({
                        callback: event,
                        status_code: 500,
                        message: Kenny.log(`S3 Error - ${JSON.stringify(s3_error)}`)
                    });
                    return;
                }

                // Finally respond with a 200

                Util.respond({
                    callback: event,
                    status_code: 200,
                    message: Kenny.log(`S3 Success - ${JSON.stringify(s3_data)}`)
                });

            });

        });

    });

}