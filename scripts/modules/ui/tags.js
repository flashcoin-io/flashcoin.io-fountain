/**
 * Created by kang on 3/9/16.
 */
import logo from './unity-logo-tag';
import login from './unity-login-tag';
import like from './unity-like-tag';
import balance from './unity-balance-tag';
import fountain from './unity-fountain-tag';

import './css/main.css!';

export default function(sandbox) {
  return {
    init: function() {
      [logo, login, like, balance, fountain].forEach(fn => {
        var instance = fn(sandbox);
        if (instance.init) instance.init();
      });
    }
  };
}
