const xmlbuilder = require('xmlbuilder');
const { parseString } = require('xml2js');

const Util = require('./util');
const Product = require('./product');
const { s3Url } = require('./aws');

const AWS_BUCKET = process.env.bucket;
const RSS_PATH = process.env.rss_path;

class Rss {

  constructor(data) {

    this.title = 'Give Me Cheap Stuff';
    this.link = 'https://givemecheapstuff.com';
    this.description = 'Awesome, cheap stuff from all of your favorite sites!';
    this.last_build_date = Util.rssDate();

    this.atom_link = {
      rel: 'self',
      type: 'application/rss+xml',
      href: s3Url(AWS_BUCKET, RSS_PATH),
    };

    this.version = '2.0';
    this.xmlns_atom = 'http://www.w3.org/2005/Atom';

    this.items = [];

  }

  setItems(items) {
    this.items = ( Array.isArray(items) && items ) || this.items;
  }

  ingestXml(data) {
    return new Promise((resolve, reject) => {
      parseString(data, (error, result = {}) => {

        if ( error ) {
          reject(error);
          return;
        }

        if ( !result.rss || !result.rss.channel || !result.rss.channel[0] || !Array.isArray(result.rss.channel[0].item) ) {
          reject('Error reading ingested XML');
        }

        const items = result.rss.channel[0].item.map(item => {

          const product = new Product();

          return product.setupItemFromXml(item);

        });

        this.setItems(items);

        resolve(this);

      });
    }).catch(error => {
      throw new Error(`ingestXml - ${error}`);
    });
  }

  ingestJson(data) {

    const json_feed = Util.parseObjectToJson(data);

    json_feed.items.map(item => {
      const product = new Product();
      return product.setupItemFromStorage(item);
    });

    this.setItems(json_feed.items);

  }

  toJsonString() {
    return JSON.stringify(this);
  }

  toXml() {

    const xml = {
      'rss': {
        '@version': this.version,
        '@xmlns:atom': this.xmlns_atom,
        'channel' : {
          'title': {
            '#text': this.title,
          },
          'link': {
            '#text': this.link,
          },
          'description': {
            '#text': this.description,
          },
          'lastBuildDate': {
            '#text': this.last_build_date,
          },
          'atom:link': {
            '@href': this.atom_link.href,
            '@rel': this.atom_link.rel,
            '@type': this.atom_link.type,
          }
        }
      }
    };

    xml.rss.channel.item = this.items.map((item, index) => {

      const data = {};

      if ( item.title ) {
        data.title = {
          '#text': item.title
        };
      }

      if ( item.link ) {
        data.link = {
          '#text': item.link
        };
      }

      // We need to add the description as a raw node as we need to add
      // image data to the description for it to be available in the
      // RSS module

      if ( item.description ) {

        data.description = {
          '#raw': Util.encodeHTML(item.description),
        };

        data.description_original = {
          '#text': item.description,
        };

      }

      // If we have an image, append it to the description as CDATA for
      // the RSS module to pick out

      if ( item.image ) {

        if ( data.description && data.description['#raw'] ) {
          data.description['#raw'] += ` <![CDATA[<img src="${item.image}" alt="" />]]>`;
        }

        data.image = {
          '#text': item.image,
        };

      }

      data.pubDate = {
        '#text': item.pub_date || Util.rssDate(),
      };

      data.guid = {
        '#text': item.guid || item.link
      };

      return data;

    })

    return xmlbuilder.create(xml).end({
      pretty: true,
    });

  }

}

module.exports = Rss;