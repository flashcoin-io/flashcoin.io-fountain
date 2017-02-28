var Setting = require('../setting/Default.js');
var dlgTimerId;

var utils = {
    getErrMsg: function(resp, sandbox, isFountain) {
        console.log("Check bug:", resp);
        switch (resp.status) {
            case 'SEND_TO_SELF':
                if (isFountain) {
                    return 'You cannot get reward tokens from your own fountain!';
                }
                return "You cannot like your own post and send Flash tokens to yourself";
            case 'SEND_TX_FAILED':
                if (resp.reason && resp.reason.indexOf('Not enough money') !== -1) {
                    if (isFountain) {
                        return "This fountain has run out of Flash tokens. Please try again later";
                    }
                    return "You don't have enough Flash tokens to like and send to the post's owner";
                }
            case 'FOUNTAIN_NOT_EXIST':
                return "Fountain doesn't exist.";
            case 'NOT_ALLOW_PERIOD':
                return "You can get the reward only once every " + this.formatDuration(resp.data);
            case 'WALLET_NOT_EXIST':
                return "There is no Safe.Cash account with this email address";
            case 'NOT_AVAILABLE':
                return "This fountain has been turned off. Please try again later";
            case 'NOT_ALLOW_DOMAIN':
                return "This page is not permitted to host this fountain";
            default:
                if (resp.code == 'Error.AccountService.Account.INVALID_EMAIL' || resp.code == 'Error.AccountService.Account.EMAIL_LOGIN_FAILED') {
                    return 'Email or password is not correct';
                } else if (resp.code == 'Error.AccountService.Account.EMAIL_LOGIN_FAILED') {
                    return resp.message;
                }
        }
        return resp.reason;
    },

    formatDuration: function(duration) {
        if (duration % 3600 == 0) {
            return duration / 3600 + ' hour(s)';
        }

        if (duration % 60 == 0) {
            return duration / 60 + ' minute(s)';
        }

        return duration + ' second(s)';
    },

    showMsg: function(data, sandbox) {
        if (dlgTimerId !== -1) {
            clearTimeout(dlgTimerId);
            dlgTimerId = -1;
        }

        var msg = data.msg;
        var timeout = data.timeout;
        var type = data.type || 'alert'; //'alert', 'error', 'success'

        var parent = document.body;
        var dlg = document.querySelector('.unity-message-dialog');
        if (!dlg) {
            var dlgContainer = document.createElement('div');
            parent.appendChild(dlgContainer);
            var html ='<dialog><p>'+msg+'</p></dialog>';

            dlgContainer.innerHTML = html;
            componentHandler.upgradeElements(dlgContainer.childNodes);

            dlg = dlgContainer.querySelector('dialog');
            dlg.classList.add('unity-message-dialog');
            dlg.style.zIndex = '999';
        } else {
            dlg.innerHTML = '<p>' + msg + '</p>';
        }

        //remove old class
        dlg.classList.remove('unity-error-dialog');
        dlg.classList.remove('unity-alert-dialog');
        dlg.classList.remove('unity-success-dialog');

        if (type == 'alert') dlg.classList.add('unity-alert-dialog');
        else if (type == 'success') dlg.classList.add('unity-success-dialog');

        else dlg.classList.add('unity-error-dialog');

        if (!dlg.showModal) {
            var dialogPolyfill = sandbox.get('lib').dialogPolyfill;
            dialogPolyfill.registerDialog(dlg);
        }

        dlg.show();

        if (timeout == null) timeout = 5000;
        dlgTimerId = setTimeout(function() {
            dlg.close();
        }, timeout);
    },
    getCasURL: function() {
        return Setting.CAS_URL;
    },
    getKeyServerURL: function() {
        return Setting.KEY_SERVER_URL;
    }
};

module.exports = utils;