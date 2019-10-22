const { putObject, copyObject } = require('./lib/aws');
const { respondToSuccess, respondToError } = require('./lib/lambda');
const Util = require('./lib/util');

const FeedAmazonGoldbox = require('./feeds/feed-amazon-goldbox');

const available_feeds = [
  new FeedAmazonGoldbox(),
];

const MAX_PRODUCT_COUNT = 400;
const PROCESS_LABEL = '[Feed][Master] Build';

const FEEDS_PATH = process.env.feeds_path;
const ACTIVE_PATH = process.env.active_path;

module.exports.feeds = function(event, context) {

  Promise.all(available_feeds.map(feed => feed.getProducts().catch(error => {
    throw new Error(error);
  })))
    .then(processFeeds)
    .then(buildRssFeed)
    .then(rss_feed => putObject(FEEDS_PATH, JSON.stringify(rss_feed), {
      CacheControl: 'max-age=0'
    }))
    .then(rss_feed => copyObject(ACTIVE_PATH, FEEDS_PATH))
    .then(data => respondToSuccess({
      label: PROCESS_LABEL,
      data,
      event,
    }))
    .catch(error => respondToError({
      label: PROCESS_LABEL,
      data: error,
      event,
      message: 'Error building feeds.',
    }));

}


/**
 * processFeeds
 * @description
 */

function processFeeds(data) {

  let products = data.reduce((accumulator, current_value) => {
    return accumulator.concat(current_value.items);
  }, []);

  // If we have blacklist items in our config, filter

  products.filter(product => product && !product.isBlacklisted());

  // Cut it down to the most recent 400 after we remove the blacklisted items

  products = products.splice(0, MAX_PRODUCT_COUNT);

  products = Util.shuffleArray(products);

  return products;

}


/**
 * buildRssFeed
 * @description
 */

function buildRssFeed(products) {
  return {
    title: 'GMCS Deals Feed',
    link: 'https://givemecheapstuff.com',
    description: 'GMCS Deals Feed',
    last_build_date: Util.rssDate(),
    items: products,
  };
}