/**
 * Created by trungtrungkang on 1/28/16.
 */
var utils = {
    ws: [' ','\n','\r','\t','\f','\x0b','\xa0','\u2000','\u2001','\u2002','\u2003','\u2004','\u2005','\u2006','\u2007','\u2008','\u2009','\u200a','\u200b','\u2028','\u2029','\u3000'],
    isNullOrUndefined: function (obj) {
        return obj === undefined || obj === null;
    },
    isNullOrEmpty: function (s) {
        return this.isNullOrUndefined(s) || s === '';
    },
    copy: function (dest, src, index) {
        var start = (index > 0) ? index : 0;
        for (var i = start; i < src.length; i++) {
            dest.push(src[i]);
        }

        return dest;
    },
    each: function (items, fn, ctx) {
        if (utils.isNullOrUndefined(items))
            return;
        var item, result;
        if (this.isArray(items)) {
            for (var i = 0; i < items.length; i++) {
                item = items[i];
                result = (ctx) ? fn.call(ctx, item, i) : fn(item, i);
                if (result === false)
                    return;
            }
        } else {
            for (var key in items) {
                if (items.hasOwnProperty(key)) {
                    item = items[key];
                    result = (ctx) ? fn.call(ctx, item, key) : fn(item, key);
                    if (result === false)
                        return;
                }
            }
        }
    },
    filter: function (items, fn, ctx) {
        var results = [];
        if (utils.isNullOrUndefined(items))
            return results;

        utils.each(items, function (item, i) {
            var valid = (ctx) ? fn.call(ctx, item, i) : fn(item, i);
            if (valid === true)
                results.push(item);
        });
        return results;
    },
    isArray: function (arr) {
        if (Array.isArray)
            return Array.isArray(arr);
        return Object.prototype.toString.call(arr) === '[object Array]';
    },
    getValue: function (obj, point) {
        var names = point.split('.');
        var val = obj;
        utils.each(names, function (name) {
            val = val[name];
            if (!val)
                return false;
        });

        return val;
    },
    extend: function (dest, src) {
        if (!src)
            return;
        if (!dest)
            dest = {};

        for (var member in src) {
            if (src.hasOwnProperty(member)) {
                dest[member] = src[member];
            }
        }

        return dest;
    },
    merge: function () {
        var dest = {};
        for (var i = 0; i < arguments.length; i++) {
            utils.extend(dest, arguments[i]);
        }
        return dest;
    },
    format: function () {
        var s = arguments[0];
        for (var i = 0; i < arguments.length - 1; i++) {
            var reg = new RegExp("\\{" + i + "\\}", "gm");
            s = s.replace(reg, arguments[i + 1]);
        }

        return s;
    },
    dom:{
        /**
         * Reads element's attributes as JS object.
         * @param {HTMLElement} element
         */
        attributes: function(element){
            var props = {};
            var attrs = element.attributes;
            utils.each(attrs, function (attr) {
                var name = attr.nodeName,
                    val = attr.nodeValue;

                props[name] = val;
            });

            return props;
        },
        /**
         * Get text content of element.
         * @param {HTMLElement} el
         */
        text: function(el){
            if (el.textContent)
                return el.textContent;
            else if (el.innerText)
                return el.innerText;
            else if(el.nodeValue)
                return el.nodeValue;
            else{
                var items = [];
                utils.each(el.childNodes, function(child){
                    if(child.nodeType === 3)
                        items.push(child.nodeValue);
                });

                return (items.length) ? items.join(' ') : null;
            }
        }
    },
    async: {
        /**
         * Interates on each item in array and processes it.
         * @param {Array} items The items.
         * @param {Function} fn The callback that is called for each item.
         * @param {Function} complete The callback that is called after all items are visited.
         * @param {Object} ctx The context that is passed to callbacks.
         */
        each: function (items, fn, complete, ctx) {
            var len = items.length;
            var count = 0;
            var stop = false;
            var results = [];
            var next = function (result) {
                results.push(result);
                count++;
                if (count === len)
                    complete.call(ctx || this, null, results);
            };
            var finish = function (err) {
                stop = true;
                complete.call(ctx || this, err, results);
            };

            if (items.length === 0)
                finish();
            else {
                utils.each(items, function (item, i) {
                    if (!stop)
                        fn.call(ctx || this, item, i, next, finish);
                    else
                        return false;
                });
            }
        }
    }
};

module.exports = utils;