/**
 * Created by kang on 3/9/16.
 */
import riot from 'riot';
import template from './unity-logo.html!text';

export default function(sandbox){
    return {
        init: function(){
            riot.tag('unity-logo', template, function(opts){
                //this.usymbol = usymbol.src;
            });

            riot.mount('unity-logo');
        }
    }
}