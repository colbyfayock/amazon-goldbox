const cheerio = require('cheerio');
const Util = require('./util');

/**
 * getGoldboxScriptsFromHtml
 * @description
 */

function getGoldboxScriptsFromHtml(html) {

  if ( typeof html !== 'string' ) return;

  const $ = cheerio.load(html.trim());
  const widgets = [];

  $('script').each((scripts_index, scripts_child) => {

    const $scripts_children = $(scripts_child);
    let children_with_widgets = $scripts_children['0'].children.filter(filterWidgetsByData);

    children_with_widgets.forEach(child => widgets.push(child));

  });

  return widgets;

}

module.exports.getGoldboxScriptsFromHtml = getGoldboxScriptsFromHtml;


/**
 * getDealsFeedFromScripts
 * @description
 */

function getDealsFeedFromScripts(scripts) {

  const items = [];

  scripts.forEach(function(widget) {

    const deals = parseScriptStringToJson(widget.data);

    if ( !deals || !deals.dealDetails ) {
      return;
    }

    for ( let key in deals.dealDetails ) {

      const item = setupProductFromJson(deals.dealDetails[key]);

      items.push(item);

    }

  });

  return items;

}

module.exports.getDealsFeedFromScripts = getDealsFeedFromScripts;


/**
 * parseScriptStringToJson
 * @description
 */

function parseScriptStringToJson(data) {

  const regex = new RegExp(/dcsServerResponse\s*=\s*(\{[\S\s]*\});/);

  const matches = data.match(regex);
  let deals;

  try {
      deals = JSON.parse(matches[1]);
  } catch(e) {
      console.log('ERROR: Failed to parse string to JSON', e);
      return false;
  }

  return deals;

}


/**
 * filterWidgetsByData
 * @description
 */

function filterWidgetsByData(item) {
  return item.data.includes('widgetToRegister') && item.data.includes('dealDetails');
}

/**
 * filterWidgetsByData
 * @description
 */

function setupProductFromJson(data) {
  return {
    title: data.title,
    link: data.egressUrl,
    description: this.title,
    image: data.primaryImage,
    is_dealoftheday: productIsDealOfTheDay(data),
    pub_date: productPublishedDate(data)
  }
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