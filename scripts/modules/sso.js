/**
 * Created by kang on 3/6/16.
 */

import request from 'superagent';
import utils from './utils';

export default function(sandbox) {
  var bus = sandbox.get('bus');

  var casURL = utils.getCasURL();

  var baseURL = utils.getKeyServerURL() + '/api';

  return {
    init: function() {
      var that = this;
      return new Promise(function(resolve) {
        var casIframe = document.getElementById('cas-iframe');
        if (!casIframe) {
          casIframe = document.createElement('iframe');
          casIframe.id = 'cas-iframe';
          casIframe.style.display = 'none';
          casIframe.src = casURL + '/token-iframe.html';
          casIframe.addEventListener('load', function() {
            resolve();
          });

          var body = document.body;
          if (!body) {
            body = document.createElement('body');
            document.documentElement.appendChild(body);
          }

          body.appendChild(casIframe);
        }

        window.addEventListener('message', function(event) {
          console.log('+++++ receive message event = ' + event);
          console.log('+++++ receive message event.data = ' + event.data);

          if (event.origin !== casURL) {
            //alert(event.origin);
            return;
          }

          var msg = (event.data) ? event.data : null;
          if (typeof(msg) == 'string') msg = JSON.parse(msg);

          if (msg) {
            if (msg.action == 'cas-ready') {
              that.onCasReady().then(function() {
                resolve();
              });
            } else {
              var token = (event.data) ? JSON.parse(event.data).data :
                null;
              if (token instanceof Array) token = token[0];
              bus.emit('sso.onGetTokenRES', token);
            }
          }
        });

        bus
          .on('unity.app.ready', that.appReady.bind(that))
          .on('sso.onLogin', that.onLogin.bind(that))
          .on('sso.onLogout', that.onLogout.bind(that))
          .on('sso.onGetToken', that.onGetToken.bind(that))
          .on('sso.onSetToken', that.onSetToken.bind(that))
          .on('sso.onGetSessionToken', that.onGetSessionToken.bind(that))
          .on('sso.deleteTokenFromCAS', that.deleteTokenFromCAS.bind(that));
      });
    },
    appReady: function() {
      var user = localStorage.getItem('user');
      if (user) {
        user = JSON.parse(user);
        var sessionToken = user.sessionToken;
        this.validateSession(sessionToken).then(function(resp) {
          sandbox.set('user', user, true);
          bus.emit('sso.onLoggedIn', user);
        }).catch(function(err) {
          return false;
        });
      }
    },
    validateSession: function(sessionToken) {
      return new Promise(function(resolve, reject) {
        request
          .get(baseURL + '/balance')
          .set('authorization', sessionToken)
          .end(function(err, resp) {
            if (err) {
              if (err.response)
                err = JSON.parse(err.response.text);
              reject({
                message: err.reason || err
              });
            } else {
              resolve(resp);
            }
          });
      });
    },
    onCasReady: function() {
      if (sandbox.get('user')) return Promise.resolve();

      var that = this;
      return new Promise(function(resolve, reject) {
        var token;
        that.onGetToken().then(function(_token) {
          if (_token != null && _token != '') {
            token = _token;
            return that.onGetSessionToken(_token);
          } else return Promise.resolve();
        }).then(function(resp) {
          if (resp && resp.rc == 1) {
            var user = {
              token: token,
              email: resp.email,
              role: resp.role,
              sessionToken: resp.sessionToken
            };

            localStorage.setItem('user', JSON.stringify(user));

            sandbox.set('user', user, true);
            bus.emit('sso.onLoggedIn', user);
          }

          resolve();
        }).catch(function(err) {
          reject(err);
        });
      });
    },
    postMessageToCAS: function(action, data) {
      var casIframe = document.getElementById('cas-iframe');
      if (casIframe) {
        // get the target window of iframe
        var win = casIframe.contentWindow;
        var message = JSON.stringify({
          'action': action,
          'data': data
        });
        // casURL: targetOrigin, the URL of the window that the messages is being sent to
        win.postMessage(message, casURL);
        console.log('+++++ Post message to iframe: ' + casURL + ' action = ' +
          action);
      }
    },
    onSetToken: function(access_token) {
      this.postMessageToCAS('set-token', access_token);
      return Promise.resolve();
    },

    onGetToken: function() {
      var that = this;
      return new Promise(function(resolve, reject) {
        bus.once('sso.onGetTokenRES', function(token) {
          resolve(token);
        });

        that.postMessageToCAS('get-token', '');
      });
    },

    deleteTokenFromCAS: function() {
      this.postMessageToCAS('delete-token', '');
    },
    onLogin: function(data) {
      return new Promise(function(resolve, reject) {
        bus.emit('md5', data.password).then(function(results) {
          request
            .post(casURL + '/api/login')
            .send({
              email: data.email,
              password: results[0]
            })
            .type('json')
            .end(function(err, resp) {
              if (resp && resp.text) resp = JSON.parse(resp.text);
              if (!err && resp.result) resolve(resp.result.token);
              else {
                if (err) {
                  if (err.response)
                    err = JSON.parse(err.response.text);
                  if (err.error) err = err.error;

                  reject({
                    message: utils.getErrMsg(err) || err
                  });
                } else reject(resp.error);
              }
            });
        });
      });
    },
    onLogout: function() {
      return new Promise(function(resolve, reject) {

      })
      bus.emit('sso.deleteTokenFromCAS').then(function(result) {
        self.update({
          isLoggedIn: false,
          loadBalanceDone: false
        });
        sandbox.set('user', null, true);
      }).catch(function(error) {
        console.log(error);
      });
    },
    onGetSessionToken: function(token) {
      return new Promise(function(resolve, reject) {
        var user = sandbox.get('user');
        if (user && user.session) {
          resolve(user.session);
          return;
        }

        request
          .post(utils.getKeyServerURL() + '/api/session')
          .set('authorization', token)
          .type('json')
          .end(function(err, resp) {
            if (!err) {
              if (resp && resp.text) resp = JSON.parse(resp.text);
              if (resp.rc == 1) {
                if (user) user.session = resp;
                resolve(resp);
              } else reject(resp);
            } else {
              if (err.response)
                err = JSON.parse(err.response.text);

              reject({
                message: err.reason || err
              });
            }
          });
      });
    }
  };
}