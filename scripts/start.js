import riot from 'riot';
import RiotControl from './lib/RiotControl';

import 'dialog-polyfill/dialog-polyfill.css!';
import dialogPolyfill from 'dialog-polyfill/dialog-polyfill';

// import 'material-design-lite/material.min.css!';
import 'material-design-lite/material.js';

import './modules/ui/css/light-custom.css!';
import './modules/ui/css/unity-material.css!';

import app from './lib/duplex/application';

import utils from './utils';

import tasks from './modules/tasks';
import sso from './modules/sso';
import crypto from './modules/crypto';
import unity from './modules/unity';

import tags from './modules/ui/tags';

//for demo pages
import pages from '../pages/pages';

app.services.set({
  utils: utils,
  lib: {
    riot: riot,
    RiotControl: RiotControl,
    dialogPolyfill: dialogPolyfill
  }
});

app.register({
  tasks: tasks,
  sso: sso,
  crypto: crypto,
  unity: unity,
  tags: tags,
  pages: pages
});

app.startAll().then(function() {
  app.services.get('bus').emit('unity.app.ready');
  console.log('app is ready.');
}).catch(console.error.bind(console));
