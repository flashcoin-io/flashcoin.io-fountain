/**
 * Created by kang on 3/6/16.
 */
import riot from 'riot';
import template from './unity-fountain.html!text';
import fountainLogoTemplate from './fountain-logo.html!text';
import css from './unity-fountain.css!text';
import helper from '../utils';

// Check wether fountain is turn off
var fountainTurnOff = false;

var task;

export default function(sandbox) {
  return {
    init: function() {
      return sandbox.require('sso').then(function() {
        riot.tag('unity-fountain', template, css, function(opts) {
          controller.call(this, sandbox, opts);
        });

        riot.tag('unity-fountain-logo', fountainLogoTemplate);

        riot.mount('unity-fountain-logo');
        riot.mount('unity-fountain');
      });
    }
  };
}

function controller(sandbox, opts) {
  var utils = sandbox.get('utils');
  this.emailId = utils.ui.newId();
  this.amount = opts.amount;

  this.changeOpts = function(_opts) {
    for (var key in _opts) {
      if (_opts.hasOwnProperty(key)) {
        opts[key] = _opts[key];
      }
    }

    var self = this;
    this.getAmount().then(function(amount) {
      self.update({
        amount: amount
      });
    }).catch(function(err) {
      console.error(err);
      throw err;
    });
  };

  this.getAmount = function() {
    console.log('getAmount function');
    return sandbox.get('bus').emit('unity.onGetFountainInfo', opts.fountain).then(function(results) {
      fountainTurnOff = false;
      var resp = (results instanceof Array) ? results[0] : results;
      console.log('unity.onGetFountainInfo', JSON.stringify(results));
      return Promise.resolve(utils.formatNumber(parseFloat(resp.fountain.settings.amount)));
    }).catch(function(err) {
      if (err.error_response) {
        var info = JSON.parse(err.error_response.text);
        if (info.status == 'NOT_AVAILABLE') {
          fountainTurnOff = true;
        }
      }
      // if (!fountainTurnOff) {
      //   helper.showMsg({
      //     msg: err.message,
      //     type: 'error'
      //   }, sandbox);
      // }
    });
  };

  this.doGetUNTs = function(event) {
    var self = this;
    var amount = this.amount;
    if (fountainTurnOff) {
      helper.showMsg({
        msg: 'This fountain has been turned off. Please try again later',
        type: 'error'
      }, sandbox);
      return;
    }

    var email = this[this.emailId].value;

    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (email == "" || email == null) {
      helper.showMsg({
        msg: 'Please enter your Safe.Cash account (email)',
        type: 'error'
      }, sandbox);
      return;
    }
    if (!re.test(email)) {
      helper.showMsg({
        msg: 'Invalid email address format',
        type: 'error'
      }, sandbox);
      return;
    }

    if (!validateAmount(amount)) {
      helper.showMsg({
        msg: 'Please enter a correct amount',
        type: 'error'
      }, sandbox);
      return;
    }

    var data = {
      fountain: opts.fountain,
      email: email,
      amount: this.amount,
      message: opts.message,
      location: window.location.hostname
    };

    sandbox.get('bus').emit('unity.onFountainTransfer', data).then(function(
      results) {
      var resp = (results instanceof Array) ? results[0] : results;

      if (resp.rc == 1) helper.showMsg({
        msg: 'You have just received ' + amount + ' Flash tokens from the fountain',
        type: 'success'
      }, sandbox);
      else helper.showMsg({
        msg: resp.reason,
        type: 'error',
      }, sandbox);
    }).catch(function(error) {
      var msg = (error.xhr) ? error.xhr.responseText : error.message;
      helper.showMsg({
        msg: msg,
        type: 'error'
      }, sandbox);
    });
  };

  this.updateAmount = function() {
    this.getAmount().then(function(amount) {
      this.update({
        amount: amount
      });
    }.bind(this));
  }.bind(this);

  this.on('mount', function() {
    this.getAmount().then(function(amount) {
      componentHandler.upgradeElements(this.root.childNodes);
      this.update({
        amount: amount
      });
    }.bind(this));

    var tasks = sandbox.get('tasks');
    if (!task) task = {
      delay: 2000,
      handler: this.updateAmount
    };

    tasks.register(task);

  });
  
}

function validateAmount(amount) {
  try {
    if (parseInt(amount) < 1)
      throw 'invalid amount';
    return true;
  } catch (ex) {}

  return false;
}