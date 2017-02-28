/**
 * Created by kang on 3/6/16.
 */
var utils = {
    ui: {
        newId: function () {
            var uuids = this._uuids;
            if (!uuids) {
                uuids = {};
                this._uuids = uuids;
            }

            var count = uuids['unity-control'];
            if (!count)
                count = uuids['unity-control'] = 1;
            else
                uuids['unity-control'] = ++count;

            return 'unity-control-' + count;
        }
    },
    formatNumber: function(val, n, x) {
        var re = '\\d(?=(\\d{' + (x || 3) + '})+' + (n > 0 ? '\\.' : '$') + ')';
        return val.toFixed(Math.max(0, ~~n)).replace(new RegExp(re, 'g'), '$&,');
    }
};

module.exports = utils;