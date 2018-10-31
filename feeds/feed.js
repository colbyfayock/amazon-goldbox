const axios = require('axios');

class Feed {

  constructor() {
    this.title = null;
    this.id = null;
    this.feed_url = null;
    this.items = [];
  }

  get() {

    const feeds = Array.isArray(this.feed_url) ? this.feed_url : [ this.feed_url ];

    const requests = feeds.filter(feed => typeof feed === 'string').map(feed => {
      return axios.get(feed).catch(error => {
        throw new Error(error);
      });
    });

    return Promise.all(requests).then(response => {
        console.log(`[Feed][${this.title}] Feed Request - Success`);
        return response;
      })
      .catch(error => {
        console.log(`[Feed][${this.title}] Feed Request - Error: ${error}`);
        throw new Error(error);
      });

  }

  setItems(items_list = []) {
    this.items = Array.from(items_list);
  }

  feed() {
    return {
      title: this.title,
      id: this.id,
      feed_url: this.feed_url,
      items: this.items,
    }
  }

}

module.exports = Feed;