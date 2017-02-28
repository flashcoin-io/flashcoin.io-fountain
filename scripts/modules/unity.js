/**
 * Created by kang on 3/8/16.
 */

import request from 'superagent';
import utils from './utils';

export default function(sandbox) {
  var baseURL = utils.getKeyServerURL() + '/api';
  return {
    init: function() {
      sandbox.get('bus')
        .on('unity.onLikeTransfer', this.onLikeTransfer.bind(this))
        .on('unity.onFountainTransfer', this.onFountainTransfer.bind(this))
        .on('unity.onGetBalance', this.onGetBalance.bind(this))
        .on('unity.onGetFountainInfo', this.onGetFountainInfo.bind(this));
    },
    onLikeTransfer: function(data) {
      return new Promise(function(resolve, reject) {
        request
          .post(baseURL + '/likeTransfer')
          .send({
            idToken: data.token,
            publicAddress: data.address,
            amount: data.amount,
            message: data.message ||
              'Sent you some Flash tokens as a reward for your good post.',
            location: data.location
          })
          .end(function(err, resp) {
            if (err) {
              if (err.response)
                err = JSON.parse(err.response.text);
              reject({
                message: utils.getErrMsg(err, sandbox) || err
              });
            } else resolve(JSON.parse(resp.text));
          });
      });
    },
    onFountainTransfer: function(data) {
      return new Promise(function(resolve, reject) {
        request
          .post(baseURL + '/fountainTransfer')
          .send({
            fountainId: data.fountain,
            toEmail: data.email,
            amount: data.amount,
            message: data.message ||
              'Sent you Flash tokens as a reward for visiting my page.',
            location: data.location
          })
          .end(function(err, resp) {
            if (err) {
              if (err.response)
                err = JSON.parse(err.response.text);

              reject({
                message: utils.getErrMsg(err, sandbox, true) || err
              });
            } else resolve(JSON.parse(resp.text));
          });
      });
    },
    onGetBalance: function(sessionId) {
      var that = this;
      return new Promise(function(resolve, reject) {
        request
          .get(baseURL + '/balance')
          .set('authorization', sessionId)
          .end(function(err, resp) {
            if (err) {
              if (err.response)
                err = JSON.parse(err.response.text);

              reject({
                message: err.reason || err
              });
            } else {
              resp = JSON.parse(resp.text);
              var user = sandbox.get('user');
              user.balance = resp.balance;
              that.saveUser(user);
              resolve(resp);
            }
          });
      });
    },
    onGetFountainInfo: function(fountainId) {
      return new Promise(function(resolve, reject) {
        var settings = sandbox.get('settings');
        if (!settings) {
          settings = {
            fountain: {}
          };
          sandbox.set('settings', settings, true);
        } 
        // else {
        //   var duration = settings.fountain.duration;
        //   if (duration != null) duration = 24;

        //   resolve(duration);
        //   return;
        // }

        request
          .get(baseURL + '/fountain/' + fountainId)
          .end(function(err, resp) {
            if (err) {
              console.log("err::::", JSON.stringify(err));
              var error = err;
              if (err.response)
                err = JSON.parse(err.response.text);
              reject({
                message: utils.getErrMsg(err, sandbox) || err,
                error_response: error.response
              });
            } else {
              var info = JSON.parse(resp.text);
              var dur = info.fountain.settings.duration;
              if (dur != null) settings.fountain.duration = parseInt(dur);

              resolve(info);
            }
          });
      });
    },
    saveUser: function(user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
  };
};