const crypto = require('crypto');
const parseString = require('xml2js').parseString;
const builder = require('xmlbuilder');
const cheerio = require('cheerio');
const Util = require('./util');
const AWS = require('./aws');
const Product = require('./product');

module.exports = (function(){

    var AmazonRSS = {},
        regex_cache = {};

    AmazonRSS.getScriptsFromHtml = function(html) {

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

    AmazonRSS.getDealsFeedFromScripts = function(scripts) {

        var data = {
            title: 'Amazon Goldbox',
            link: 'https://amazon.com/gp/goldbox',
            description: 'Amazon Goldbox',
            pub_date: Date.now(),
            items: []
        }

        scripts.forEach(function(widget) {

            var deals = parseScriptStringToJson(widget.data);

            if ( !deals || !deals.dealDetails ) {
                return;
            }

            for ( let key in deals.dealDetails ) {

              let product = new Product();

              product.setupProductFromJson(deals.dealDetails[key]);

              data.items.push(product);

            }

        });

        return data;

    }

    AmazonRSS.parseJsonScriptFeed = function(feed, options) {

        if ( !feed || !feed.rss || !Array.isArray(feed.rss.channel) ) return {};
        if ( typeof options !== 'object' ) options = {};

        var data = {
            title: AmazonRSS.title(feed.rss.channel[0]),
            link: AmazonRSS.link(feed.rss.channel[0], options.affiliate_id),
            description: AmazonRSS.description(feed.rss.channel[0]),
            pub_date: AmazonRSS.date(feed.rss.channel[0]),
            items: []
        }

        if ( feed.rss.channel[0] && Array.isArray(feed.rss.channel[0].item) && feed.rss.channel[0].item.length > 0 ) {

            data.items = feed.rss.channel[0].item.map((item) => {
                return AmazonRSS.item(item, options.affiliate_id);
            }).filter((item) => item.link.indexOf('/product/null') === -1);

        }

        return data;

    }

    AmazonRSS.feedToJson = function(feed, callback) {
        if ( !feed || typeof callback !== 'function' ) return null;
        parseString(feed, callback);
    }

    AmazonRSS.feedToXml = function(feed) {

        var xml = {
            'rss': {
                '@version': '2.0',
                '@xmlns:atom': 'http://www.w3.org/2005/Atom',
                'channel' : {
                    'title': {
                        '#text': 'Amazon.com Gold Box Deals'
                    },
                    'link': {
                        '#text': 'http://www.amazon.com/gp/goldbox'
                    },
                    'description': {
                        '#text': 'Amazon.com Gold Box Deals'
                    },
                    'lastBuildDate': {
                        '#text': Util.rssDate()
                    },
                    'atom:link': {
                      '@href': AWS.s3Url(process.env.bucket, process.env.rss_path),
                      '@rel': 'self',
                      '@type': 'application/rss+xml',
                    }
                }
            }
        };

        if ( feed && Array.isArray(feed.items) && feed.items.length > 0 ) {
            xml.rss.channel.item = feed.items.map((item, index) => {

                var data = {},
                    description = '';

                if ( item.title ) {
                    data.title = {
                        '#text': item.title
                    }
                }

                if ( item.link ) {
                    data.link = {
                        '#text': item.link
                    }
                }

                // We need to add the description as a raw node as we need to add
                // image data to the description for it to be available in the
                // RSS module

                if ( item.description ) {
                    data.description = {
                        '#raw': Util.encodeHTML(item.description)
                    }
                }

                // If we have an image, append it to the description as CDATA for
                // the RSS module to pick out

                if ( item.image ) {
                    data.description['#raw'] += ` <![CDATA[<img src="${item.image}" alt="" />]]>`;
                }

                if ( index === 0 ) {
                  data.pubDate = {
                    '#text': Util.rssDate()
                  }
                } else if ( item.pub_date ) {
                  data.pubDate = {
                    '#text': item.pub_date
                  }
                }

                data.guid = {
                  '#text': item.guid || item.link
                }

                return data;

            })
        }

        return builder.create(xml).end({ pretty: true });

    }

    AmazonRSS.parseRawFeed = function(feed, options) {

        if ( !feed || !feed.rss || !Array.isArray(feed.rss.channel) ) return {};
        if ( typeof options !== 'object' ) options = {};

        var data = {
            title: AmazonRSS.title(feed.rss.channel[0]),
            link: AmazonRSS.link(feed.rss.channel[0], options.affiliate_id),
            description: AmazonRSS.description(feed.rss.channel[0]),
            pub_date: AmazonRSS.date(feed.rss.channel[0]),
            items: []
        }

        if ( feed.rss.channel[0] && Array.isArray(feed.rss.channel[0].item) && feed.rss.channel[0].item.length > 0 ) {

            data.items = feed.rss.channel[0].item.map((item) => {
                return AmazonRSS.item(item, options.affiliate_id);
            }).filter((item) => item.link.indexOf('/product/null') === -1);

        }

        return data;

    }

    AmazonRSS.sortFeed = function(feed) {

        if ( !feed || !Array.isArray(feed.items) ) return feed;

        return Object.assign({}, feed, {
            items: feed.items.sort((a, b) => {
              return new Date(b.pub_date) - new Date(a.pub_date);
            })
        })

    }

    AmazonRSS.isBlacklistItem = function(title, blacklist) {

        if ( !Array.isArray(blacklist) ) return [];

        return blacklist.filter((string) => {
            return title.toLowerCase().indexOf(string) !== -1;
        }).length > 0;

    }

    AmazonRSS.dealoftheday = function(items) {

        if ( !Array.isArray(items) ) return [];

        return items.map((item) => {
            return Object.assign({}, item, {
                description: item.is_dealoftheday ? `${item.description} #dealoftheday` : item.description
            })
        });

    }

    AmazonRSS.filterItems = function(items, array) {

        if ( !Array.isArray(items) || !Array.isArray(array) ) return [];

        var blacklist = array.map((string) => string.toLowerCase());

        return items.filter((item) => {
            return !AmazonRSS.isBlacklistItem(item.title, blacklist);
        });

    }

    AmazonRSS.getKeywordRegex = function(string) {

        if ( !regex_cache[string] ) {
            regex_cache[string] = new RegExp('(^|\\s?)(' + string + ')([\\s,.!]?)', 'i');
        }

        return regex_cache[string];

    }

    AmazonRSS.keywordifyItems = function(items, list, symbol) {

        if ( !Array.isArray(items) || !Array.isArray(list) ) return [];

        if ( typeof symbol !== 'string' ) symbol = '#';

        // Make sure we're dealing with a normalized object list

        const hashlist = list.map((item = {}) => {

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

        return items.map((item) => {

          let description = item.description;

          hashlist.forEach(term => {

            const regex = AmazonRSS.getKeywordRegex(term.keyword);
            const hashtag = `${symbol}${term.term.replace(' ', '')}`;

            description = description.replace(regex, '$1' + hashtag + '$3');

          });

          if ( description.charAt(0) === '@' ) {
            description = `.${description}`;
          }

          return Object.assign({}, item, {
            description: description,
          });

        });

    }

    AmazonRSS.item = function(item, affiliate_id) {

        var data = {
          title: AmazonRSS.title(item),
          link: AmazonRSS.link(item, affiliate_id),
          description: AmazonRSS.description(item),
          image: AmazonRSS.image(item),
          list_price: AmazonRSS.listPrice(item),
          deal_price: AmazonRSS.dealPrice(item),
          savings: AmazonRSS.savings(item),
          is_dealoftheday: false,
          pub_date: AmazonRSS.date(item),
          guid: AmazonRSS.guid(item)
        };

        if ( data.title && data.title.indexOf('Deal of the Day: ') !== -1 ) {
            data.is_dealoftheday = true;
            data.title = data.title.replace('Deal of the Day: ', '');
            data.description = data.description.replace('Deal of the Day: ', '');
        }

        return data;

    }

    AmazonRSS.title = function(item) {
        if ( !item || !item.title ) return null;
        return item.title[0];
    }

    AmazonRSS.link = function(item, affiliate_id) {

        if ( !item || !item.link ) return null;

        var params = {};

        if ( affiliate_id ) {
            params.tag = affiliate_id;
        }

        return Util.addQueryParameters(item.link[0], params);

    }

    AmazonRSS.descriptionList = function(item) {
        if ( !item || !item.description || !item.description[0] ) return [];
        return item.description[0].split(/<\/?[table|tr|td]+>/).filter((string) => {
            return string.length > 0 && string.toLowerCase().indexOf('expires') === -1;
        });
    }

    AmazonRSS.description = function(item) {

        if ( !item || !item.description ) return null;

        var description = [],
            title = AmazonRSS.title(item),
            deal_price = AmazonRSS.dealPrice(item),
            savings = AmazonRSS.savings(item);

        if ( title ) {
            description.push(Util.truncate(title, 220));
        }

        if ( deal_price ) {
            description.push(`Only ${deal_price}`);
        }

        if ( savings ) {
            description.push(`Save ${savings}!`);
        }

        return description.join(' - ');

    }

    AmazonRSS.image = function(item) {

        if ( !item || !item.description ) return null;

        var image_piece = AmazonRSS.descriptionList(item).filter((piece) => {
            return piece.indexOf('img') !== -1;
        })[0];

        if ( !image_piece ) return null;

        image_piece = /.*?<img.*?src=['"](.*?)["'].*?/.exec(image_piece);

        if ( Array.isArray(image_piece) && image_piece[1] ) {
            image_piece = image_piece[1].replace('_SL160_', '_SL800_');
        } else {
            image_piece = null;
        }

        return image_piece;

    }

    AmazonRSS.listPrice = function(item) {

        if ( !item || !item.description ) return null;

        var description_list = AmazonRSS.descriptionList(item),
            price;

        price = description_list.filter((string) => {
            return string.toLowerCase().indexOf('list price') !== -1;
        })[0];

        if ( !price ) return null;

        if ( price.indexOf('strike') !== -1 ) {
            price = /List\ Price:\ <strike>(.*)<\/strike>/.exec(price);
        } else {
            price = /List\ Price:\ (.*)/.exec(price);
        }

        return Array.isArray(price) && price[1] ? price[1] : null;

    }

    AmazonRSS.dealPrice = function(item) {

        if ( !item || !item.description ) return null;

        var description_list = AmazonRSS.descriptionList(item),
            price;

        price = description_list.filter((string) => {
            return string.toLowerCase().indexOf('deal price') !== -1;
        })[0];

        if ( !price ) return null;

        price = /Deal\ Price:\ (.*)/.exec(price);

        return Array.isArray(price) && price[1] ? price[1] : null;

    }

    AmazonRSS.savings = function(item) {

        if ( !item || !item.description ) return null;

        var list_price = AmazonRSS.listPrice(item),
            deal_price = AmazonRSS.dealPrice(item);

        if ( typeof list_price !== 'string' || typeof deal_price !== 'string' ) return null;

        list_price = parseFloat(list_price.replace('$', ''));
        deal_price = parseFloat(deal_price.replace('$', ''));

        if ( isNaN(list_price) || isNaN(deal_price) ) return null;

        return Math.round( ( 1 - ( deal_price / list_price ) ) * 100 ) + '%';

    }

    AmazonRSS.date = function(item) {

        if ( !item ) return null;

        if ( item.pub_date ) {
            return item.pub_date[0];
        }

        if ( item.pubDate ) {
            return item.pubDate[0];
        }

        if ( item.lastBuildDate ) {
            return item.lastBuildDate[0];
        }

        return null;

    }

    AmazonRSS.guid = function(item) {

      if ( !item ) return null;

      return item.guid[0];

    }

    return AmazonRSS;

    /**
     * filterWidgetsByData
     * @description
     */

    function filterWidgetsByData(item) {
      return item.data.includes('widgetToRegister') && item.data.includes('dealDetails')
    }

    /**
     * parseScriptStringToJson
     * @description
     */

    function parseScriptStringToJson(data) {

        const regex = new RegExp(/widgetToRegister\.dcsServerResponse\s*=\s*(\{[\S\s]*\});/);

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

})();