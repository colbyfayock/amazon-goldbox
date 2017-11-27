const parseString = require('xml2js').parseString;
const Util = require('./util');

module.exports = (function(){

    var AmazonRSS = {}

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

    AmazonRSS.item = function(item, affiliate_id) {
        return {
            title: AmazonRSS.title(item),
            link: AmazonRSS.link(item, affiliate_id),
            description: AmazonRSS.description(item),
            image: AmazonRSS.image(item),
            list_price: AmazonRSS.listPrice(item),
            deal_price: AmazonRSS.dealPrice(item),
            savings: AmazonRSS.savings(item),
            date: AmazonRSS.date(item)
        }
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