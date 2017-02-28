/**
 * Created by kang on 3/13/16.
 */
import riot from 'riot';

export default function(sandbox){
    return {
        init: function(){
            riot.tag('unity-page', null, function(opts){
                var tag = this;
                var moduleName = opts.controller;

                System.import(moduleName).then(function(module){
                    var constructor = module['default'];
                    var controller = constructor(sandbox);
                    if(controller.init) controller.init(tag, opts);
                    tag = null;
                });
            });

            var pages = riot.mount('unity-page');
            sandbox.get('bus').once('unity.app.ready', function(){
              if(pages.length > 0) riot.route.start(true);
            });
        }
    };
}
