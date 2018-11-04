const awssdk = require('aws-sdk');
const s3 = new awssdk.S3();

const AWS_BUCKET = process.env.bucket;

/**
 * s3Url
 * @description
 */

function s3Url(bucket, path) {
  return `https://s3.amazonaws.com/${bucket}/${path}`;
}

module.exports.s3Url = s3Url;


/**
 * s3LiveUrl
 * @description
 */

function s3LiveUrl(url, path) {
  if ( typeof url !== 'string' || url.indexOf('.json') === -1 ) return url;
  return url.replace('.json', '-live.json');
}

module.exports.s3LiveUrl = s3LiveUrl;


/**
 * getObject
 * @description
 */

function getObject(key, body) {

  return new Promise((resolve, reject) => {

    s3.getObject({
      Bucket: AWS_BUCKET,
      Key: key,
    }, (error, data) => {

      let response_body;

      if ( error ) {
        console.log(`[AWS][Get] Error: Failed to get object ${key}; ${error}`);
        reject(error);
        return;
      }

      try {
        response_body = data.Body.toString('utf-8');
      } catch(e) {
        console.log(`[AWS][Get] Error: Failed to parse object ${key}; ${e}`);
        reject(e);
        return;
      }

      console.log(`[AWS][Get] Success: Get object ${key}`);
      resolve(response_body);

    });

  });

}

module.exports.getObject = getObject;


/**
 * putObject
 * @description
 */

function putObject(key, body, settings = {}) {

  const key_split = typeof key === 'string' && key.split('.');
  const key_extension = key_split && key_split[key_split.length - 1];

  const object_settings = Object.assign({
    Bucket: AWS_BUCKET,
    Key: key,
    Body: body,
  }, settings);

  if ( key_extension === 'json' ) {
    object_settings.ContentType = 'application/json';
  } else if ( key_extension === 'xml' ) {
    object_settings.ContentType = 'application/xml';
  }

  return new Promise((resolve, reject) => {

    s3.putObject(object_settings, (error, data) => {

      if ( error ) {
        console.log(`[AWS][Put] Error: Failed to put object ${key}; ${error}`);
        reject(error);
        return;
      }

      console.log(`[AWS][Put] Success: Put object ${key}`);
      resolve(data);

    });

  });

}

module.exports.putObject = putObject;


/**
 * copyObject
 * @description
 */

function copyObject(key, source_key) {

  return new Promise((resolve, reject) => {

    s3.copyObject({
      Bucket: AWS_BUCKET,
      Key: key,
      CopySource: `${AWS_BUCKET}/${source_key}`,
    }, (error, data) => {

      if ( error ) {
        console.log(`[AWS][Copy] Error: Failed to copy ${source_key} to ${key}; ${error}`);
        reject(error);
        return;
      }

      console.log(`[AWS][Copy] Success: Copied ${AWS_BUCKET}/${source_key} to ${key}`);
      resolve(data);

    });

  });

}

module.exports.copyObject = copyObject;