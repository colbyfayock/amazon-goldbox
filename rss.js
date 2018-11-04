const axios = require('axios');

const { s3Url, s3LiveUrl, getObject, copyObject, putObject } = require('./lib/aws');
const { respondToSuccess, respondToError } = require('./lib/lambda');
const Product = require('./lib/product');
const Rss = require('./lib/rss');
const Util = require('./lib/util');

const MAX_RSS_COUNT = 20;
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

  if ( Array.isArray(data.items) && data.items.length > 0 ) return data;

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

function getNewFeedItemAndSave(data) {

  const new_item = data.items.shift();

  return new Promise((resolve, reject) => {

    putObject(ACTIVE_PATH, JSON.stringify(data), {
      CacheControl: 'max-age=0'
    })
      .then(() => {
        resolve(new_item);
      })
      .catch(error => {
        throw new Error(error);
      });

  });

}


/**
 * processNewItem
 * @description
 */

function processNewItem(item) {

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
        console.log(rss_feed.items.map((item) => {
          return {
            title: item.title,
            pub_date: item.pub_date,
          }
        }))
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