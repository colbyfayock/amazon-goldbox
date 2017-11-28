const parseString = require('xml2js').parseString;
const Util = require('./util');

module.exports = (function(){

    var AmazonRSS = {},
        regex_cache = {};

    AmazonRSS.feedToJson = function(feed, callback) {
        if ( !feed || typeof callback !== 'function' ) return null;
        parseString(feed, callback);
    }

    AmazonRSS.parseRawFeed = function(feed, options) {

        if ( !feed || !feed.rss || !Array.isArray(feed.rss.channel) ) return {};
        if ( typeof options !== 'object' ) options = {};

        var data = {
            title: AmazonRSS.title(feed.rss.channel[0]),
            link: AmazonRSS.link(feed.rss.channel[0], options.affiliate_id),
            description: AmazonRSS.description(feed.rss.channel[0]),
            date: AmazonRSS.date(feed.rss.channel[0]),
            items: null
        }

        if ( feed.rss.channel[0] && Array.isArray(feed.rss.channel[0].item) ) {

            data.items = feed.rss.channel[0].item.map((item) => {
                return AmazonRSS.item(item, options.affiliate_id);
            });

        }

        return data;

    }

    AmazonRSS.sortFeed = function(feed) {

        if ( !feed || !Array.isArray(feed.items) ) return feed;

        return Object.assign({}, feed, {
            items: feed.items.sort((a, b) => {
              return new Date(b.date) - new Date(a.date);
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
            regex_cache[string] = new RegExp('([\\s])(' + string + ')([\\s,.!]?)', 'i');
        }

        return regex_cache[string];

    }

    AmazonRSS.keywordifyItems = function(items, list, symbol) {

        if ( !Array.isArray(items) || !Array.isArray(list) ) return [];

        if ( typeof symbol !== 'string' ) symbol = '#';

        var hashlist;

        if ( Array.isArray(list) && typeof list[0] === 'string' ) {
            hashlist = list.map((string) => string.toLowerCase());
        } else if ( typeof list === 'object' ) {
            hashlist = list.map((object) => {
                return Object.assign(object, {
                    keyword: object.keyword.toLowerCase()
                });
            });
        }

        return items.map((item) => {

            var description = item.description;

            for ( var i = 0, len = list.length; i < len; i++ ) {

                var keyword = list[i].keyword || list[i],
                    term = list[i].term || list[i],
                    regex = AmazonRSS.getKeywordRegex(keyword),
                    hashtag = `${symbol}${term.replace(' ', '')}`;

                description = description.replace(regex, '$1' + hashtag + '$3');

            }

            return Object.assign(item, {
                description: description
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
            date: AmazonRSS.date(item)
        };

        if ( data.title.indexOf('Deal of the Day: ') !== -1 ) {
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
        return Util.addQueryParameters(item.link[0], {
            tag: affiliate_id
        });
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

        return Array.isArray(image_piece) && image_piece[1] ? image_piece[1] : null;

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
        if ( !item || !item.pubDate ) return null;
        return item.pubDate[0];
    }

    return AmazonRSS;

})();