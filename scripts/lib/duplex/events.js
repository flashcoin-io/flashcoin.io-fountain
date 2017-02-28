/*********************************
 * @author: Trung Trung Kang <thanhduythuc@unseen.is>
 * @data: 12/26/15
 *
 * Events pattern
 *****************************************************/

function Events(){}

Events.prototype = (function(){
    var events = {};

    function getNames(name){
        var kv = {tag: null};
        var names = name.split('|');
        if(names.length > 1) {
            kv.tag = names[0];
            kv.name = names[1];
        }
        else kv.name = name;
        
        return kv;
    }

    function raiseEvent(name, args, ctx){
        var evts = events[name];
        if(evts){
            var promises = [];
            for(var i = 0; i < evts.length;){
                var h = evts[i];
                if(h.once) evts.splice(i, 1);
                else i++;
                
                var fn = h.fn;
                var result = fn.apply(ctx, args || []);
                var promise = (result instanceof Promise) ? result : Promise.resolve(result);
                promises.push(promise);
            }
            return Promise.all(promises);
        }
        else return Promise.resolve();
    }
    
    return {
        emit: function(name){
            return this.raise(name, [].slice.call(arguments, 1));
        },
        raise: function(name, args, ctx){
            return raiseEvent(name, args, ctx);
        },
        once: function(name, fn){
            this.on(name, fn, true);
            return this;
        },
        on: function(name, fn, once){
            var kv = getNames(name);
            var _name = kv.name;
            var evts = events[_name];
            if(!evts) evts = events[_name] = [];
            
            evts.push({fn: fn, once: once, tag: kv.tag});
            return this;
        },
        off: function(name, fn){
            var kv = getNames(name);
            var _name = kv.name;
            var _tag = kv.tag;
            var no_tag = (name.indexOf('|') === -1);
            
            var evts = events[_name];
            if(evts){
                for(var i = 0; i < evts.length; i++){
                    var h = evts[i];
                    if((fn && h.fn === fn) || no_tag || h.tag === _tag)
                        evts.splice(i, 1);
                }
            }
            
            return this;
        }
    };
})();

module.exports = Events;


