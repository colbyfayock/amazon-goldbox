const Util = require('./util');

class Product {

  setupProductFromJson(data) {

    this.title = data.title;
    this.link = productLink(data);
    this.description = this.title;
    this.image = data.primaryImage;
    this.list_price = null;
    this.deal_price = null;
    this.savings = null;
    this.is_dealoftheday = productIsDealOfTheDay(data);
    this.pub_date = productPublishedDate(data);
    this.guid = productGuid(data);

    return this;

  }

}


/**
 * productLink
 * @description The link to the product
 */

function productLink(data) {

  let link = Util.addQueryParameters(data.egressUrl, {
    tag: process.env.affiliate_id
  });

  link.replace(' ', '%20');

  return link;

}


/**
 * productIsDealOfTheDay
 * @description Is the product a deal of the day?
 */

function productIsDealOfTheDay(data) {
  return data.type === 'DEAL_OF_THE_DAY';
}


/**
 * productPublishedDate
 * @description The product's true published date
 */

function productPublishedDate(data) {

  // Figure out the difference between the scraped time since
  // start and the current time

  const date_timestamp = new Date().getTime();
  let deal_time = date_timestamp + parseFloat(data.msToStart);

  deal_time = new Date(deal_time);

  return Util.rssDate(deal_time);

}


/**
 * productGuid
 * @description Creatse the product link with the current timestamp that serves as the GUID
 */

function productGuid(data) {

  const date_timestamp = new Date().getTime();
  let product_link = productLink(data);

  return Util.addQueryParameters(product_link, {
    gmcsts: date_timestamp
  });

}

module.exports = Product;