const request = require('request');
const aws = require('aws-sdk');
const s3 = new aws.S3();

const AmazonRSS = require('./lib/amazon-rss');
const Util = require('./lib/util');
const Kenny = require('./lib/kenny');

const blacklist = process.env.blacklist_path ? require(process.env.blacklist_path) : false;
const hashtags = process.env.hashtags_path ? require(process.env.hashtags_path) : false;
const accounts = process.env.accounts_path ? require(process.env.accounts_path) : false;

/**
 * recent
 * @description Grabs the most recent 400 items and transform
 *     the feed into hashtags and mentions
 */

module.exports.recent = function(event, context) {

    Kenny.set({
        service: process.env.service,
        function: 'recent'
    });

    const goldbox_url = `https://s3.amazonaws.com/${process.env.bucket}/${process.env.goldbox_path}`;

    const recent_path = `${process.env.bucket}/${process.env.recent_path}`;

    Kenny.log(`Goldbox Get - ${goldbox_url}`);

    // Grab the goldbox.json path provided from /goldbox

    request(goldbox_url, {}, (error, response, body) => {

        if ( error ) {
            Util.respond({
                callback: event,
                status_code: 500,
                message: Kenny.log(`Goldbox Get Error - ${JSON.stringify(error)}`)
            });
            return;
        }

        // Parse the JSON and create a new object

        var feed = Object.assign({}, JSON.parse(body), {
            items: JSON.parse(body).items
        });

        // If we have blacklist items in our config, filter

        if ( Array.isArray(blacklist) ) {
            feed.items = AmazonRSS.filterItems(feed.items, blacklist);
        }

        // Cut it down to the most recent 400 after we remove the blacklisted items

        feed.items = feed.items.splice(0, 400);

        // Add the deal of the day hashtag to eligible items

        feed.items = AmazonRSS.dealoftheday(feed.items);

        // If we have a hashtag list in our config, transform the feed to include them

        if ( Array.isArray(hashtags) ) {
            feed.items = AmazonRSS.keywordifyItems(feed.items, hashtags, '#');
        }

        // If we have a list of accounts, transform the feeds to include mentions to them

        if ( Array.isArray(accounts) ) {
            feed.items = AmazonRSS.keywordifyItems(feed.items, accounts, '@');
        }

        Kenny.log(`S3 Put - ${recent_path}`);

        // Once we have the desired feed, dump it into an S3 bucket

        s3.putObject({
            Bucket: process.env.bucket,
            Key: process.env.recent_path,
            Body: JSON.stringify(feed),
        }, function(s3_error, s3_data) {

            if ( s3_error ) {
                Util.respond({
                    callback: event,
                    status_code: 500,
                    message: Kenny.log(`S3 Put Error - ${JSON.stringify(s3_error)}`)
                });
                return;
            }

            Kenny.log(`S3 Put Success - ${JSON.stringify(s3_data)}`);

            // Create a copied "live" version which we'll use and modify as we
            // pull new entries for the feed

            Kenny.log(`S3 Copy - ${recent_path} to ${recent_path.replace('.json', '-live.json')}`);

            s3.copyObject({
                Bucket: process.env.bucket,
                CopySource: `${recent_path}`,
                Key: process.env.recent_path.replace('.json', '-live.json')
            }, function(copy_error, copy_data) {

                if ( copy_error ) {
                    Util.respond({
                        callback: event,
                        status_code: 500,
                        message: Kenny.log(`S3 Copy Error - ${JSON.stringify(copy_error)}`)
                    });
                    return;
                }

                // Finally respond with a 200

                Util.respond({
                    callback: event,
                    status_code: 200,
                    message: Kenny.log(`S3 Copy Success - [${JSON.stringify(s3_data)}, ${JSON.stringify(copy_data)}]`)
                });

            });

        });

    });

}