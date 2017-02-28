/**
 * Created by kang on 3/8/16.
 */
import riot from 'riot';
import template from './unity-balance.html!text';
import Odemeter from 'odometer/odometer';
import css from './unity-balance.css!text';
import sso from '../sso';

import 'odometer/themes/odometer-theme-train-station.css!';

var oldBalance = 0;

// Mark status. Balance button will not flash on first load balance
var isFirstChangeBalance = true;

var
  oActive, nMouseX, nMouseY, nStartX, nStartY,
  bMouseUp = true,
  nZFocus = /* the highest z-Index present in your page plus 1: */ 100;

export default function(sandbox) {
  return {
    init: function() {
      return sandbox.require('sso').then(function() {
        riot.tag('unity-balance', template, css, function(opts) {
          controller.call(this, sandbox, opts);
        });

        riot.mount('unity-balance');
      });
    }
  }
}

function controller(sandbox, opts) {
  var self = this;
  var utils = sandbox.get('utils');

  this.balanceButtonId = utils.ui.newId();
  console.log("generate balanceButtonID", this.balanceButtonId);
  var od;
  var bus = sandbox.get('bus');
  this.isLoggedIn = (sandbox.get('user') != null);
  self.loadBalanceDone = false;
  this.isHidden = false;

  this.onClick = function() {
    if (this.isHidden) {
      return;
    }

    if (!this.isLoggedIn) {
      var lfdlg = this.tags['unity-login'];
      if (lfdlg) lfdlg.openDialog();
      return;
    }
  };

  this.onMinClick = function() {
    this.isHidden = true;
    self.update({
      isHidden: this.isHidden
    });
  };

  this.onMaxClick = function() {
    this.isHidden = false;
    self.update({
      isHidden: this.isHidden
    });
  }

  this.logoutClick = function(event) {
    event.stopPropagation();
    bus.emit('sso.deleteTokenFromCAS').then(function(result) {
      self.update({
        isLoggedIn: false,
        loadBalanceDone: false,
        oldBalance: 0
      });
      sandbox.set('user', null, true);
      localStorage.removeItem('user');
    }).catch(function(error) {
      console.log(error);
    });
    return false;
  }

  this.on('mount', function() {
    componentHandler.upgradeDom();

    if (this.isLoggedIn) {
      registerUpdateBalanceTask(this.root);
    }
    console.log('onMountBalance');
    //Set value for balance's coordinate
    var balanceElement = document.getElementById(self.balanceButtonId);
    if (balanceElement && localStorage.getItem('balanceLeft')) {
      balanceElement.style.left = localStorage.getItem('balanceLeft');
      balanceElement.style.top = localStorage.getItem('balanceTop');
    }
  });

  bus.on('sso.onLoggedIn', function() {
    this.update({
      isLoggedIn: true
    });
    registerUpdateBalanceTask(this.root);
  }.bind(this));

  var task;

  function registerUpdateBalanceTask(root) {
    if (!od) {
      od = new Odemeter({
        el: root.querySelector('.odometer'),
        value: 0,
        // Any option (other than auto and selector) can be passed in here
        format: '(,ddd)',
        theme: 'train-station'
      });
    }

    var user = sandbox.get('user');
    if (user && user.balance != null) {
      self.update({
        loadBalanceDone: true,
        email: user.email
      });
      od.update(user.balance);
    }

    var tasks = sandbox.get('tasks');
    if (!task) task = {
      delay: 2000,
      handler: updateBalance
    };

    tasks.register(task);
  }

  function updateBalance() {
    var user = sandbox.get('user');
    if (user) {
      bus.emit('sso.onGetSessionToken', user.token).then(function(results) {
        var resp = results[0];
        if (resp.rc == 1) {
          self.email = resp.email;
          self.update({
            email: self.email
          });
          return bus.emit('unity.onGetBalance', resp.sessionToken);
        } else return Promise.reject({
          message: resp.reason
        });
      }).then(function(results) {
        var resp = (results instanceof Array) ? results[0] : results;
        if (resp.rc == 1) {
          if (this.oldBalance != resp.balance) {
            this.oldBalance = resp.balance;
            var balanceElement = document.getElementById(self.balanceButtonId);
            if (balanceElement && !isFirstChangeBalance) {
              balanceElement.className = "unity-balance update-balance-flash";
            }
            isFirstChangeBalance = false;
            setTimeout(function() {
              balanceElement.className = "unity-balance";
            }, 5000);
          }
          od.update(resp.balance);
          self.update({
            loadBalanceDone: true
          });
        } else return Promise.reject({
          message: resp.reason
        });
      }).catch(function(error) {
        console.log(error || '');
      });
    }
  };

  document.onmousedown = function(oPssEvt1) {
    var bExit = true,
      oMsEvent1 = oPssEvt1 || /* IE */ window.event;
    for (var iNode = oMsEvent1.target || /* IE */ oMsEvent1.srcElement; iNode; iNode = iNode.parentNode) {
      if (iNode.id && iNode.id == self.balanceButtonId) {
        bExit = false;
        oActive = iNode;
        break;
      }
    }
    if (bExit) {
      return;
    }
    bMouseUp = false;
    nStartX = nStartY = 0;
    for (var iOffPar = oActive; iOffPar; iOffPar = iOffPar.offsetParent) {
      nStartX += iOffPar.offsetLeft;
      nStartY += iOffPar.offsetTop;
    }
    nMouseX = oMsEvent1.clientX;
    nMouseY = oMsEvent1.clientY;
    oActive.style.zIndex = nZFocus++;
    return false;
  };

  document.onmousemove = function(oPssEvt2) {
    if (bMouseUp) {
      if (oActive) {
        localStorage.setItem('balanceLeft', oActive.style.left);
        localStorage.setItem('balanceTop', oActive.style.top);
      }
      return;
    }
    var oMsEvent2 = oPssEvt2 || /* IE */ window.event;
    var left = nStartX + oMsEvent2.clientX - nMouseX;
    if (left > 0 && left + oActive.offsetWidth < document.body.clientWidth) {
      oActive.style.left = String(left) + "px";
    }
    var top = nStartY + oMsEvent2.clientY - nMouseY;
    if (top > 0 && top + oActive.offsetHeight < document.body.clientHeight) {
      oActive.style.top = String(top) + "px";
    }
  };

  document.onmouseup = function() {
    bMouseUp = true;
  };
}