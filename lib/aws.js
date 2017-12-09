module.exports = (function(){

    var AWS = {};

    AWS.s3Url = function(bucket, path) {
        return `https://s3.amazonaws.com/${bucket}/${path}`;
    }

    AWS.s3LiveUrl = function(url, path) {
        if ( typeof url !== 'string' || url.indexOf('.json') === -1 ) return url;
        return url.replace('.json', '-live.json');
    }

    return AWS;

})();