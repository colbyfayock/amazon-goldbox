const request = require('request');
const aws = require('aws-sdk');
const s3 = new aws.S3();

const AmazonRSS = require('./lib/amazon-rss');
const Util = require('./lib/util');

/**
 * recent
 * @description Grabs the most recent 400 items and transform
 *     the feed into hashtags and mentions
 */

module.exports.recent = function(event, context) {

    Util.logHandler({
        namespace: process.env.service,
        message: `RSS Get - ${process.env.rss_feed}`
    });

    // Grab the goldbox.json path provided from /goldbox

    request(`https://s3.amazonaws.com/${process.env.bucket}/${process.env.goldbox_path}`, {}, (error, response, body) => {

        // Parse the JSON and create a new object

        var feed = Object.assign({}, JSON.parse(body), {
            items: JSON.parse(body).items
        });

        if ( error ) {

            Util.logHandler({
                namespace: process.env.service,
                callback: event,
                status_code: 500,
                message: `RSS Error - ${JSON.stringify(error)}`
            });

            return;

        }

        // If we have blacklist items in our config, filter

        if ( Array.isArray(process.env.blacklist) ) {
            feed.items = AmazonRSS.filterItems(feed.items, process.env.blacklist);
        }

        // Cut it down to the most recent 400 after we remove the blacklisted items

        feed.items = feed.items.splice(0, 400);

        // Add the deal of the day hashtag to eligible items

        feed.items = AmazonRSS.dealoftheday(feed.items);

        // If we have a hashtag list in our config, transform the feed to include them

        if ( Array.isArray(process.env.hashtags) ) {
            feed.items = AmazonRSS.keywordifyItems(feed.items, process.env.hashtags, '#');
        }

        // If we have a list of accounts, transform the feeds to include mentions to them

        if ( Array.isArray(process.env.accounts) ) {
            feed.items = AmazonRSS.keywordifyItems(feed.items, process.env.accounts, '@');
        }

        Util.logHandler({
            namespace: process.env.service,
            message: `S3 Put - ${process.env.bucket}/${process.env.recent_path}`
        });

        // Once we have the desired feed, dump it into an S3 bucket

        s3.putObject({
            Bucket: process.env.bucket,
            Key: process.env.recent_path,
            Body: JSON.stringify(feed),
        }, function(s3_error, s3_data) {

            if ( s3_error ) {

                Util.logHandler({
                    namespace: process.env.service,
                    callback: event,
                    status_code: 500,
                    message: `S3 Error - ${JSON.stringify(s3_error)}`
                });

                return;

            }

            Util.logHandler({
                namespace: process.env.service,
                callback: event,
                status_code: 200,
                message: `S3 Success - ${JSON.stringify(s3_data)}`
            });

        });

    });

}