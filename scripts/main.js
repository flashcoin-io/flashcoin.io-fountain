/**
 * Created by kang on 3/4/16.
 */

(function() {
    var baseURL = 'http://localhost:3000/bower_components';
    var modules = [];

    if(typeof(componentHandler) === 'undefined'){
        modules.push({type: 'css', url: 'https://fonts.googleapis.com/icon?family=Material+Icons'});
        modules.push({type: 'css', url: baseURL + '/material-design-lite/material.css'});
        modules.push({type: 'js', url: baseURL + '/material-design-lite/material.js'});
    }
    if(typeof(jQuery) === 'undefined') modules.push({type: 'js', url: baseURL + '/jquery/dist/jquery.js'});

    modules.forEach(function (item) {
        if (item.type === 'css') {
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = item.url;
            document.head.appendChild(link);
        }
        else if (item.type === 'js') {
            var se = document.createElement('script');
            se.type = 'text/javascript';
            se.src = item.url;
            document.body.appendChild(se);
        }
    });

    function onReady(cb) {
        var timerId = setInterval(function () {
            if (typeof(componentHandler) !== 'undefined') {
                clearInterval(timerId);
                cb();
            }
        }, 500);
    }

    function el(name, settings, childs, text){
        var html = '';
        html += '<' + name;

        var parts = [' '];
        for(var i in settings){
            if(settings.hasOwnProperty(i)){
                parts.push(i + '="' + settings[i]+'"');
            }
        }
        html += parts.join(' ');

        parts = [];
        if(childs && childs.length > 0){
            parts.push('>');
            for(var i = 0; i < childs.length; i++) parts.push(childs[i]);
            html += parts.join('');
        }
        else html += '>';

        if(text != null) html += text;

        html += '</' + name + '>';
        return html;
    }

    onReady(function () {
        var uList = document.querySelectorAll('.unity-like');
        for (var i = 0; i < uList.length; i++) {
            var container = uList[i];

            container.innerHTML =
                el(
                    'button',
                    {class: 'mdl-button mdl-js-button mdl-js-ripple-effect mdl-button--icon'},
                    [
                        el('i', {class: 'material-icons', role: 'presentation'}, [], 'thumb_up'),
                        el('span', {class:'visuallyhidden'}, [], 'like comment')
                    ]
                );
            $(container).css({color: 'rgba(0, 0, 0, 0.24)', marginRight: '16px'});

            componentHandler.upgradeElement(container.firstElementChild);
        }
    });
})();
