module.exports = (function(){

    var Util = {};

    /**
     * Get an RSS pubDate from a Javascript Date instance.
     * via https://gist.github.com/samhernandez/5260558
     * @param Date - optional
     * @return String
     */

    Util.rssDate = function(date) {

        if ( typeof date === 'undefined' ) {
            date = new Date();
        }

        var pieces = date.toString().split(' '),
            offsetTime = pieces[5].match(/[-+]\d{4}/),
            offset = (offsetTime) ? offsetTime : pieces[5],
            parts = [
                pieces[0] + ',',
                pieces[2],
                pieces[1],
                pieces[3],
                pieces[4],
                offset
            ];

        return parts.join(' ');

    }

    /**
     * respond
     * @description Manages response callbacks
     */

    Util.respond = function(options) {

        if ( typeof options.callback !== 'function' ) return;

        options.callback({
            statusCode: options.status_code,
            message: options.message
        });

    }

    Util.queryParamsToObject = function(string) {

        if ( typeof string !== 'string' ) return null;

        var query_string = string.replace('?', ''),
            query_split = query_string.split('&'),
            query_object = {};

        for ( var i = 0, len = query_split.length; i < len; i++ ) {
          var current_split = query_split[i].split('=');
          query_object[decodeURIComponent(current_split[0])] = decodeURIComponent(current_split[1]);
        }

        return query_object;

    }

    Util.addQueryParameters = function(url, object) {

        if ( typeof url !== 'string' || typeof object !== 'object' ) return url;

        var url_split = url.split('?'),
            url_base = url_split[0],
            url_search = url_split[1],
            url_search_object;

        if ( url_search ) {
            url_search_object = Util.queryParamsToObject(url_search);
        } else {
            url_search_object = {};
        }

        url_search_object = Object.assign(url_search_object, object);

        return url_base + '?' + Object.keys(url_search_object).map(function(k) {
            return k + '=' + url_search_object[k];
        }).join('&');

    }


    Util.truncate = function(string, length, ellipsis) {

        if ( typeof string !== 'string' ) return string;

        var truncated = string,
            truncated_length = truncated.length;

        if ( truncated_length <= length ) return truncated;

        if ( ellipsis === false ) {
          return truncated.substring(0, length);
        }

        truncated = truncated.substring(0, length - 3).trim();

        // If the very last character is already a "." we don't want to
        // show a .... (4) so we remove one before adding the 3

        if ( truncated.substr(-1) === '.' ) {
          truncated = truncated.slice(0, -1);
        }

        return truncated + '...';

    };


    return Util;

})();