const Feed = require('./feed');
const Product = require('../lib/product');
const Rss = require('../lib/rss');
const { getGoldboxScriptsFromHtml, getDealsFeedFromScripts } = require('../lib/goldbox');

class FeedAmazonGoldbox extends Feed {

  constructor() {

    super();

    this.title = 'Amazon Bestsellers';
    this.id = 'feed-amazon-bestsellers';
    this.feed_url = [
      // 'https://amazon.com/gp/rss/bestsellers/mobile-apps',
      // 'https://amazon.com/gp/rss/bestsellers/photo/',
      'https://amazon.com/gp/rss/bestsellers/wireless/',
      'https://amazon.com/gp/rss/bestsellers/electronics/',
      'https://amazon.com/gp/rss/bestsellers/home-garden/',
      // 'https://amazon.com/gp/rss/bestsellers/kitchen/',
      'https://amazon.com/gp/rss/bestsellers/office-products/',
      'https://amazon.com/gp/rss/bestsellers/lawn-garden/',
      // 'https://amazon.com/gp/rss/bestsellers/sporting-goods/',
      'https://amazon.com/gp/rss/bestsellers/toys-and-games/',
      'https://amazon.com/gp/rss/bestsellers/videogames/',
    ];

  }

  getProducts() {
    return new Promise((resolve, reject) => {

      this.get().then(response => {

        const response_data = Array.isArray(response) ? response : [ response ];

        const feeds_to_json = response_data.map(feed => {

          const rss_feed = new Rss();

          return new Promise((resolve, reject) => {

            rss_feed.ingestXml(feed.data)
              .then(data => {
                resolve(rss_feed);
              })
              .catch(reject);

            return rss_feed;

          });

        });

        Promise.all(feeds_to_json).then(feeds => {

          let products = feeds.reduce((accumulator, current_value) => {
            if ( !current_value || !Array.isArray(current_value.items) ) return accumulator;
            return accumulator.push(current_value.items[0]) && accumulator;
          }, []);

          products.map(product => {

            product.setLinkParams({
              tag: process.env.affiliate_id
            });

            return product;

          });

          this.setItems(products);

          resolve(this.feed());

        })

      }).catch(error => {
        reject(error);
      });

    });
  }

}

module.exports = FeedAmazonGoldbox;