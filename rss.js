const request = require('request');
const aws = require('aws-sdk');
const s3 = new aws.S3();

const AmazonRSS = require('./lib/amazon-rss');
const Util = require('./lib/util');
const Kenny = require('./lib/kenny');

/**
 * rss
 * @description Creates an RSS feed based on the pre-existing feed
 *     and pulls 1 new from the "live" recent path
 */

module.exports.rss = function(event, context) {

    Kenny.set({
        service: process.env.service,
        function: 'rss'
    });

    const recent_live_path = process.env.recent_path.replace('.json', '-live.json');
    const recent_live_url = `https://s3.amazonaws.com/${process.env.bucket}/${recent_live_path}`;

    const rss_url = `https://s3.amazonaws.com/${process.env.bucket}/${process.env.rss_path}`;

    // Grab the goldbox.json path provided from /goldbox

    Kenny.log(`Recent Get - ${recent_live_url}`);

    request(recent_live_url, {}, (recent_error, recent_response, recent_body) => {

        if ( recent_error ) {
            Util.respond({
                callback: event,
                status_code: 500,
                message: Kenny.log(`Recent Get Error - ${JSON.stringify(recent_error)}`)
            });
            return;
        }

        Kenny.log(`Recent Get Success - ${recent_live_url}`);

        // Parse the JSON and create a new object

        var feed = JSON.parse(recent_body),
            new_item = feed.items.shift();

        // Try to grab the most recent RSS feed

        Kenny.log(`RSS Get - ${rss_url}`);

        request(rss_url, {}, (rss_error, rss_response, rss_body) => {

            // This should fail silently, as if we don't find the XML, we want
            // to create a new one

            if ( rss_error ) {
                Kenny.log(`RSS Get Error - ${JSON.stringify(rss_error)}`);
            }

            Kenny.log(`RSS Get Success - ${rss_url}`);

            // Try to parse the feed. If this isn't available, it will return null

            AmazonRSS.feedToJson(rss_body, (json_error, json_results) => {

                var rss_feed = AmazonRSS.parseRawFeed(json_results);

                if ( !Array.isArray(rss_feed.items) ) {
                    rss_feed.items = [];
                }

                rss_feed.items.unshift(new_item);
                rss_feed.items = rss_feed.items.splice(0,48);

                // Save the RSS feed XML into S3

                Kenny.log(`S3 Put RSS - ${rss_url}`);

                s3.putObject({
                    Bucket: process.env.bucket,
                    Key: process.env.rss_path,
                    Body: AmazonRSS.feedToXml(rss_feed),
                }, function(s3_error, s3_data) {

                    if ( s3_error ) {
                        Util.respond({
                            callback: event,
                            status_code: 500,
                            message: Kenny.log(`S3 Put RSS Error - ${JSON.stringify(s3_feed_error)}`)
                        });
                        return;
                    }

                    Kenny.log(`S3 Put RSS Success - ${s3_data}`);

                    // Replace the "live" version of the feed so we don't double add any
                    // entries to the feed

                    Kenny.log(`S3 Put Recent - ${recent_live_url}`);

                    s3.putObject({
                        Bucket: process.env.bucket,
                        Key: recent_live_path,
                        Body: JSON.stringify(feed),
                    }, function(s3_feed_error, s3_feed_data) {

                        if ( s3_feed_error ) {
                            Util.respond({
                                callback: event,
                                status_code: 500,
                                message: Kenny.log(`S3 Put Recent Error - ${JSON.stringify(s3_feed_error)}`)
                            });
                            return;
                        }

                        // Finally respond with a 200

                        Util.respond({
                            callback: event,
                            status_code: 200,
                            message: Kenny.log(`S3 Put Recent Success - ${JSON.stringify(s3_feed_data)}`)
                        });

                    });

                });

            });

        });

    });

}