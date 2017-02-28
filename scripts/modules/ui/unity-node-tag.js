import riot from 'riot';
import layoutTemplate from './unity-layout.html!text';

export default function(sandbox) {
    return {
        init: function() {
            riot.tag('unity-node', '<yield/>', function(opts) {
                this.on('mount', function(){
                    let items = [];
                    for (var i = 0; i < this.root.childNodes.length; i++) {
                        var node = this.root.childNodes[i];
                        if (node.nodeType == 1) {
                            items.push(node);
                        }
                    }

                    let points = opts.points || '';
                    sandbox.get('bus').emit('unity-layout.nav.onBuildItems:' + points, items);
                    this.unmount();
                });
            });

            riot.tag(
                'unity-layout',
                layoutTemplate,
                function(opts){
                    let root = this.root;
                    let navItemsPath = opts['unity-nav-items'] || '/home/nav/items';
                    let contentInstane = null;

                    sandbox.get('bus')
                        .on('unity-layout.nav.onBuildItems:' + navItemsPath, function(items){
                            if(!items || items.length == 0) return;
                            let nav = root.querySelector('.mdl-navigation');
                            items.forEach(el => {
                                nav.appendChild(el);
                            });

                            componentHandler.upgradeElements(root.childNodes);
                        })
                        .on('unity-layout.page-content.onBuildContent', function(template, constructor){
                            if(contentInstane) contentInstane.unmount(true);
                            riot.tag('unity-page-content', template, constructor);
                            contentInstane = riot.mount('unity-page-content')[0];
                        });

                    this.on('mount', function(){
                      componentHandler.upgradeElements(root.childNodes);
                    });
                });
            riot.mount('unity-layout');
        }
    };
}
