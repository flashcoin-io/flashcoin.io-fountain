/**
 * Created by kang on 3/6/16.
 */
import riot from 'riot';
import template from './unity-like.html!text';
import css from './unity-like.css!text';
import helper from '../utils';

export default function(sandbox) {
  return {
    init: function() {
      return sandbox.require('sso').then(function() {
        riot.tag('unity-like', template, css, function(opts) {
          controller.call(this, sandbox, opts);
        });

        riot.mount('unity-like');
      });
    }
  };
}

function controller(sandbox, opts) {
  var utils = sandbox.get('utils');
  this.isLoggedIn = (sandbox.get('user') != null);
  this.likeButtonId = utils.ui.newId();

  this.changeOpts = function(_opts) {
    for (var key in _opts) {
      if (_opts.hasOwnProperty(key)) {
        opts[key] = _opts[key];
      }
    }

    this.update();
  };
  this.likeButtonId = utils.ui.newId();
  this.menuBtnId = utils.ui.newId();
  this.hideMenuTimeout = undefined;
  var test = document.createElement(this.likeButtonId);

  this.onMouseover = function(event) {
    var menuBtn = document.getElementById(this.menuBtnId);
    menuBtn.style.opacity = 1;
    menuBtn.className = 'menuBtn activeMenu';
    clearTimeout(this.hideMenuTimeout);
  };

  this.onMouseLeaveBtn = function(event) {
    console.log('this.onMouseLeaveBtn');
    var menuBtn = document.getElementById(this.menuBtnId);
    this.hideMenuTimeout = setTimeout(function() {
      menuBtn.className = 'menuBtn';
    }, 300);
  }

  this.onMouseOverOpt = function(event) {
    var menuBtn = document.getElementById(this.menuBtnId);
    menuBtn.style.opacity = 1;
    //    setTimeout(function() {
    menuBtn.className = 'menuBtn activeMenu';
    clearTimeout(this.hideMenuTimeout);
    //   }, 1000);
  };

  this.onMouseLeaveOpt = function(event) {
    console.log('this.onMouseLeaveOpt');
    var menuBtn = document.getElementById(this.menuBtnId);
    menuBtn.style.opacity = 0;
    this.hideMenuTimeout = setTimeout(function() {
      menuBtn.className = 'menuBtn';
    }, 1000);
  };

  this.doLike = function(event) {
    this.isLoggedIn = (sandbox.get('user') != null);
    if (!this.isLoggedIn) {
      var lftag = this.tags['unity-login'];
      lftag.openDialog();
      return;
    }

    var self = this;
    var infoContainer = this.root.parentElement;
    event.stopPropagation();
    var address = opts.publicAddress;

    var user = sandbox.get('user');
    if (user) {
      var data = {
        token: user.token,
        address: address,
        amount: opts.amount,
        message: opts.message,
        location: window.location.hostname
      };
      sandbox.get('bus').emit('unity.onLikeTransfer', data).then(function(
        results) {
        var resp = (results instanceof Array) ? results[0] : results;

        if (resp.rc == 1) helper.showMsg({
          msg: "You have sent " + opts.amount + " Flash tokens to this post's owner.",
          type: 'success'
        }, sandbox);
        else helper.showMsg({
          msg: resp.reason,
          type: 'error'
        }, sandbox);
      }).catch(function(error) {
        var msg = (error.xhr) ? error.xhr.responseText : error.message;
        helper.showMsg({
          msg: msg,
          type: 'error'
        }, sandbox);
      });
    }
  };

  this.like10 = function(e) {
    this.likeCustomAmount(10);
  };

  this.like20 = function(e) {
    this.likeCustomAmount(20);
  };

  this.like30 = function(e) {
    this.likeCustomAmount(30);
  };

  this.like40 = function(e) {
    this.likeCustomAmount(40);
  };

  this.likeCustom = function() {
    var customAmount = this.amountValue;
    if (!customAmount || isNaN(customAmount) || customAmount < 1) {
      helper.showMsg({
        msg: 'Please enter a valid amount of Flash tokens',
        type: 'error'
      }, sandbox);
      return;
    } else {
      customAmount = NumberOrginal(customAmount);
      this.likeCustomAmount(customAmount);
    }
  };

  this.likeCustomAmount = function(customAmount) {
    this.onMouseLeaveOpt();
    this.isLoggedIn = (sandbox.get('user') != null);
    if (!this.isLoggedIn) {
      var lftag = this.tags['unity-login'];
      lftag.openDialog();
      return;
    }

    var infoContainer = this.root.parentElement;
    var address = opts.publicAddress;

    var user = sandbox.get('user');
    if (user) {
      var data = {
        token: user.token,
        address: address,
        amount: customAmount || 10,
        message: opts.message
      };
      sandbox.get('bus').emit('unity.onLikeTransfer', data).then(function(
        results) {
        var resp = (results instanceof Array) ? results[0] : results;

        if (resp.rc == 1) helper.showMsg({
          msg: "You have sent " + customAmount + " Flash tokens to this post's owner.",
          type: 'success'
        }, sandbox);
        else helper.showMsg({
          msg: resp.reason,
          type: 'error'
        }, sandbox);
      }).catch(function(error) {
        var msg = (error.xhr) ? error.xhr.responseText : error.message;
        helper.showMsg({
          msg: msg,
          type: 'error'
        }, sandbox);
      });
    }
  };

  sandbox.get('bus').on('sso.onLoggedIn', function() {
    this.update({
      isLoggedIn: true
    });
  }.bind(this));

  this.on('mount', function() {
    componentHandler.upgradeDom();
  });

  this.menu_onclick = function(e) {
    e.preventDefault();
    e.stopPropagation();
  };

  this.editSendAmount = function(e) {
    this.amountValue = e.target.value;
  }

  this.filterNumberEdit = function(event) {
    var charCode = parseInt(event.charCode);
    var keyCode = parseInt(event.keyCode);
    return ((48 <= charCode && charCode <= 57) || keyCode == 8 || keyCode == 9 || keyCode == 127);
  };

}

function NumberOrginal(Decimalnumber) {
  return Number(Decimalnumber.toString().replace(/,/g, ""));
}

function info(msg) {
  alert(msg);
  return;
  var parent = document.body;
  var snackbarContainer = parent.querySelector('.unity-control-snackbar');
  if (!snackbarContainer) {
    var div = document.createElement('div');
    parent.appendChild(div);

    var html =
      `
        <div class="unity-control-snackbar mdl-js-snackbar mdl-snackbar">
          <div class="mdl-snackbar__text"></div>
          <button class="mdl-snackbar__action" type="button"></button>
        </div>
        `;

    div.innerHTML = html;
    componentHandler.upgradeDom();
    snackbarContainer = div.firstElementChild;
  }

  var data = {
    message: msg,
    timeout: 5000
  };

  //snackbarContainer.style.display = '';
  //setPosition(snackbarContainer);
  snackbarContainer.MaterialSnackbar.showSnackbar(data);
  setTimeout(function() {
    snackbarContainer.style.display = 'none';
  }, 5000);
}

function setPosition(el) {
  // Fixes dual-screen position                         Most browsers      Firefox
  var dualScreenLeft = window.screenLeft != undefined ? window.screenLeft : screen.left;
  var dualScreenTop = window.screenTop != undefined ? window.screenTop : screen.top;

  var width = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;
  var height = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;
  var w = el.offsetWidth;
  var h = el.offsetHeight;

  var left = ((width / 2) - (w / 2)) + dualScreenLeft;
  var top = ((height / 2) - (h / 2)) + dualScreenTop;
  el.style.left = left;
  el.style.top = top;
}