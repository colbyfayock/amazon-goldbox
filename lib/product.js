const Util = require('./util');
const path = require('path');
const blacklist = require(path.resolve(process.env.blacklist_path))
const hashtags = require(path.resolve(process.env.hashtags_path))
const accounts = require(path.resolve(process.env.accounts_path))

const xml_key_map = {
  title: 'title',
  link: 'link',
  description_original: 'description',
  image: 'image',
  pubDate: 'pub_date',
  guid: 'guid',
  description: 'xml_description',
};

class Product {

  constructor(data = {}) {
    this.title = data.title;
    this.link = productLink(data.link);
    this.description = productDescription(this.title);
    this.image = data.image;
    this.list_price = undefined;
    this.deal_price = undefined;
    this.savings = undefined;
    this.is_dealoftheday = data.is_dealoftheday;
    this.pub_date = undefined;
    this.guid = productGuid(this.link);
  }

  setupItemFromStorage(data) {
    Object.keys(data).forEach(key => {
      this[key] = data[key];
    });
    return this;
  }

  setupItemFromXml(data) {

    Object.keys(xml_key_map).forEach(key => {

      if ( data[key] && data[key][0] ) {
        this[xml_key_map[key]] = typeof data[key][0] === 'string' && data[key][0].trim()
      }

    });

    this.title = typeof this.title === 'string' && this.title.replace(/^#\d+:\s/, 'Bestseller: ');
    this.description = productDescription(this.title)
    this.guid = productGuid(this.link)

    if ( this.xml_description && !this.image ) {
      this.image = getImageFromXmlDescription(this.xml_description);
    }

    return this;

  }

  setLinkParams(params) {
    this.link = Util.addQueryParameters(this.link, params || {});
    return this.link;
  }

  isBlacklisted() {

    if ( !Array.isArray(blacklist) ) return false;

    return blacklist.filter((string) => {
      return this.title.toLowerCase().includes(string.toLowerCase());
    }).length > 0;

  }

  refreshGuid() {
    this.guid = productGuid(this.guid || this.link);
  }

  setPublishedDate(date) {
    this.pub_date = Util.rssDate(date);
  }

}

module.exports = Product;


/**
 * productLink
 * @description The link to the product
 */

function productLink(link) {
  if ( typeof link !== 'string' ) return '';
  return link.trim().replace(/\s/g, '%20');
}


/**
 * productDescription
 * @description The description to the product. This is the title transformed with hashtags
 */

function productDescription(description) {

  const list = [].concat(hashtags, accounts);

  return keywordify(description, list);

}


/**
 * productGuid
 * @description Creatse the product link with the current timestamp that serves as the GUID
 */

function productGuid(link) {

  const date_timestamp = new Date().getTime();

  return Util.addQueryParameters(link, {
    gmcsts: date_timestamp
  });

}


/**
 * keywordify
 * @description
 */

function keywordify(string, list, symbol = '#') {

  if ( typeof string !== 'string' ) return '';
  if ( !Array.isArray(list) ) return string;

  // Make sure we're dealing with a normalized object list

  const term_list = list.map((item = {}) => {

    let keyword;
    let term;

    if ( typeof item === 'string' ) {
      keyword = item;
      term = item;
    } else {
      keyword = item.keyword;
      term = item.term;
    }

    // Set the list keywords to lowercase so we don't have to worry about
    // case for matches and normalize data objects

    return {
      keyword: `${keyword}`.toLowerCase(),
      term: `${term}`,
    };

  });

  term_list.forEach(term => {

    const regex = getKeywordRegex(term.keyword);
    const hashtag = `${symbol}${term.term.replace(' ', '')}`;

    string = string.replace(regex, '$1' + hashtag + '$3');

  });

  return string;

}


/**
 * getKeywordRegex
 * @description
 */

function getKeywordRegex(string) {
  return Util.getRegex('(^|\\s)(' + string + ')([\\s,.!]?)', 'i');
}


/**
 * getImageFromXmlDescription
 * @description
 */

function getImageFromXmlDescription(string) {

  const spaces_and_attributes = '\\s*[A-Za-z0-9\\s="]*\\s*';
  const urls = '[\\w\\.:\/=_-]*';
  const regex = Util.getRegex(`<img${spaces_and_attributes}src="(${urls})"${spaces_and_attributes}\/>`);
  const matches = string.match(regex);

  return matches && matches[1];

}