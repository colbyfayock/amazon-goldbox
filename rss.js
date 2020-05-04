const jwt = require('jsonwebtoken');

const { getObject, copyObject, putObject } = require('./lib/aws');
const { respondToSuccess, respondToError } = require('./lib/lambda');
const Product = require('./lib/product');
const Rss = require('./lib/rss');
const Util = require('./lib/util');

const MAX_RSS_COUNT = 5;
const PROCESS_LABEL = '[RSS] Build';

const FEEDS_PATH = process.env.feeds_path;
const ACTIVE_PATH = process.env.active_path;
const RSS_PATH = process.env.rss_path;

module.exports.rss = function(event, context) {

  getActiveFeed()
    .then(checkItemsStatus)
    .then(mapActiveItemsToProducts)
    .then(getNewFeedItemAndSave)
    .then(processNewItem)
    .then(updateRssFeed)
    .then(data => respondToSuccess({
      label: PROCESS_LABEL,
      data,
      event,
    }))
    .catch(error => respondToError({
      label: PROCESS_LABEL,
      data: error,
      event,
      message: 'Error building RSS feed',
    }));

}


/**
 * getActiveFeed
 * @description
 */

function getActiveFeed() {

  return new Promise((resolve, reject) => {
    getObject(ACTIVE_PATH)
      .then(Util.parseObjectToJson)
      .then(resolve)
      .catch(reject)
  })

}


/**
 * mapActiveItemsToProducts
 * @description
 */

function mapActiveItemsToProducts(data) {

  console.log(`${PROCESS_LABEL} - Mapping items to products`);

  const feed_items = data.items.map(item => {

    const product = new Product();

    return product.setupItemFromStorage(item);

  });

  return {
    ...data,
    items: feed_items,
  };

}


/**
 * checkItemsStatus
 * @description
 */

function checkItemsStatus(data) {

  console.log(`${PROCESS_LABEL} - Checking items status`);

  if ( Array.isArray(data.items) && data.items.length > 0 ) {
    console.log(`${PROCESS_LABEL} - Found items`);
    return data;
  }

  console.log(`${PROCESS_LABEL} - Copying Feeds: No items are available, refreshing data.`);

  return new Promise((resolve, reject) => {
    copyObject(ACTIVE_PATH, FEEDS_PATH)
      .then(getActiveFeed)
      .then(resolve)
      .catch(reject)
  });

}


/**
 * getNewFeedItemAndSave
 * @description
 */

async function getNewFeedItemAndSave(data) {

  console.log(`${PROCESS_LABEL} - Get new feed item and tweet`);

  const new_item = data.items.shift();
  const token = jwt.sign({
    twitter_consumer_key: process.env.GMCS_TWITTER_CONSUMER_KEY,
    twitter_consumer_secret: process.env.GMCS_TWITTER_CONSUMER_SECRET,
    twitter_access_token_key: process.env.GMCS_TWITTER_ACCESS_TOKEN_KEY,
    twitter_access_token_secret: process.env.GMCS_TWITTER_ACCESS_TOKEN_SECRET,
  }, process.env.GMCS_TWEET_APP_SECRET);

  let payload = {};
  let response;

  Object.keys(new_item).forEach(key => {
    if ( typeof new_item[key] !== 'undefined') {
      payload[key] = new_item[key];
    }
  });

  try {
    response = await fetch('https://tweet-with-twitter.netlify.com/.netlify/functions/tweet', {
      method: 'post',
      body: JSON.stringify(payload),
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      }
    });
  } catch(e) {
    console.log(`${PROCESS_LABEL} - [TWITTER][TWEET] Error: ${JSON.stringify(e)}`);
    throw e;
  }

  if ( response.status === 200 ) {
    console.log(`${PROCESS_LABEL} - [TWITTER][TWEET] Success`);
  } else {
    console.log(`${PROCESS_LABEL} - [TWITTER][TWEET] Error: ${response.statusText}`);
    throw new Error(`Failed to tweet: ${response.statusText}`);
  }

  try {
    await putObject(ACTIVE_PATH, JSON.stringify(data), {
      CacheControl: 'max-age=0'
    });
  } catch(e) {
    throw e;
  }

  return new_item;
}


/**
 * processNewItem
 * @description
 */

function processNewItem(item) {

  console.log(`${PROCESS_LABEL} - Processing new item`);

  item.refreshGuid();
  item.setPublishedDate();

  return item;

}


/**
 * updateRssFeed
 * @description
 */

function updateRssFeed(item) {

  return new Promise((resolve, reject) => {

    getObject(RSS_PATH)
      .catch(error => {

        if ( !error || error.code !== 'NoSuchKey' ) {
          throw new Error(error.message);
        }

      })
      .then(parseRssFeed)
      .then(rss_feed => {
        rss_feed.items.unshift(item)
        rss_feed.items = rss_feed.items.splice(0, MAX_RSS_COUNT);
        return rss_feed;
      })
      .then(rss_feed => {
        return new Promise((resolve, reject) => {
          putObject(RSS_PATH, rss_feed.toXml(), {
            CacheControl: 'max-age=0'
          })
            .then(() => resolve(rss_feed))
            .catch(reject)
        });
      })
      .then(resolve)
      .catch(reject);

  });

}


/**
 * parseRssFeed
 * @description
 */

function parseRssFeed(feed) {

  const rss_feed = new Rss();

  if ( !feed ) {
    return rss_feed;
  }

  return new Promise((resolve, reject) => {

    rss_feed.ingestXml(feed)
      .then(data => {
        resolve(rss_feed);
      })
      .catch(reject);

    return rss_feed;

  });

}