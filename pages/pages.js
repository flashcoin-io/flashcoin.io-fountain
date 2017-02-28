import riot from 'riot';

import likePage from './like-button/controller';
import fountainPage from './fountain/controller';
import balancePage from './balance/controller';

import layout from '../scripts/modules/ui/unity-node-tag';

export default function(sandbox){
  return {
    init: function(){
      layout(sandbox).init();

      [likePage, fountainPage, balancePage].forEach(constructor => {
        var page = constructor(sandbox);
        if(page.init) page.init();
      });

      riot.tag('unity-pages', null, function(opts){
        riot.route.start(true);
      });

      sandbox.get('bus').on('unity.app.ready', function(){
        riot.mount('unity-pages');
      });
    }
  };
}
