const Feed = require('./feed');
const Product = require('../lib/product');
const { getGoldboxScriptsFromHtml, getDealsFeedFromScripts } = require('../lib/goldbox');

class FeedAmazonGoldbox extends Feed {

  constructor() {

    super();

    this.title = 'Amazon Goldbox';
    this.id = 'feed-amazon-goldbox';
    this.feed_url = 'https://amazon.com/gp/goldbox';

  }

  getProducts() {
    return new Promise((resolve, reject) => {

      this.get().then(response => {

        const response_data = Array.isArray(response) ? response[0] : response;
        const scripts = getGoldboxScriptsFromHtml(response_data.data);
        const deals = getDealsFeedFromScripts(scripts);
        const products = deals.map(mapProductFromDeal);

        this.setItems(products);

        resolve(this.feed());

      }).catch(error => {
        reject(error);
      });

    });
  }

}

module.exports = FeedAmazonGoldbox;


function mapProductFromDeal(deal) {
  const product = new Product(deal);

  product.setLinkParams({
    tag: process.env.affiliate_id
  });

  return product;
}