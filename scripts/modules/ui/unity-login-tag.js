/**
 * Created by kang on 3/9/16.
 */
import riot from 'riot';
import template from './unity-login.html!text';
import css from './unity-login.css!text';

export default function(sandbox) {
  return {
    init: function() {
      return sandbox.require('sso').then(function() {
        riot.tag('unity-login', template, css, function(opts) {
          controller.call(this, sandbox, opts);
        });

        riot.mount('unity-login');

        return Promise.resolve();
      });
    }
  };
}

function controller(sandbox, opts) {
  var self = this;
  var dialogPolyfill = sandbox.get('lib').dialogPolyfill;
  var bus = sandbox.get('bus');
  var utils = sandbox.get('utils');
  this.isLoggedIn = (sandbox.get('user') != null);
  var showing = false;

  var bus = sandbox.get('bus');
  bus.on('ui.loginform.isShowing', function() {
    return showing;
  });

  this.emailId = utils.ui.newId();
  this.passwordId = utils.ui.newId();
  this.rememberId = utils.ui.newId();
  this.errMsg = "";

  this.on('mount', function() {
    this.remember = true;
    componentHandler.upgradeElements(this.root.childNodes);
  });

  this.openDialog = function() {
    bus.emit('ui.loginform.isShowing').then(function(results) {
      var isShowing = false;
      for (var i = 0; i < results.length; i++) {
        if (results[i]) {
          isShowing = true;
          break;
        }
      }
      
      if (!isShowing) {
        var dlg = self.root.querySelector('.unity-login-dialog');
        if (!dlg.showModal) {
          dialogPolyfill.registerDialog(dlg);
        }
        self.errMsg = "";
        self[self.emailId].value = "";
        self[self.passwordId].value = "";
        dlg.show();
        showing = true;
      }
    });
  };

  this.closeDialog = function() {
    var dlg = this.root.querySelector('.unity-login-dialog');
    self.errMsg = "";
    self.update({
      errMsg: ""
    });
    dlg.close();
    showing = false;
  };

  this.refreshLoginForm = function() {
    var lf = this.root.querySelector('.mdl-menu');
    lf["MaterialMenu"].show();
  };

  this.toggleRemember = function(event) {
    var remember1 = !this.remember;
    self.update({
      remember: remember1
    });
    return true;
  };

  this.doLogin = function(event) {
    if (this.errMsg) this.errMsg = ' ';
    var email = this[this.emailId].value;
    var pass = this[this.passwordId].value;

    var validateEmail = function(email) {
      if (!email || !email.trim()) {
        return "Email is needed to login!";
      }

      var emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
      var checkEmail = email.toLowerCase().match(emailRegex);

      if (checkEmail === null) {
        return "Invalid email format!";
      }

      return "";
    }

    var validateEmailMessage = validateEmail(email);
    //if email not valid
    if (validateEmailMessage) {
      this.update({
        errMsg: validateEmailMessage
      });
      return;
    }
    //not yet entered password
    if (!pass) {
      this.update({
        errMsg: "Password is needed to login!"
      });
      return;
    }
    var param = {
      email: email,
      password: pass,
      resource: 'web'
    };

    bus.emit('sso.onLogin', param).then(function(token) {
      if (token instanceof Array) token = token[0];

      if (this[this.rememberId].checked) {
        bus.emit('sso.onSetToken', token);
      }

      this.closeDialog();

      var user = sandbox.get('user');
      if (!user) {
        user = {
          email: param.email,
          token: token
        };
        sandbox.set('user', user);
      } else {
        user.email = param.email;
        user.token = param.token;
      }

      bus.emit('sso.onLoggedIn');
    }.bind(this)).catch(function(err) {
      this.update({
        errMsg: err.message
      });
      console.error(err.message);
    }.bind(this));
  };
}