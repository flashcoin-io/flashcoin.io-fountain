/**
 * Created by kang on 1/30/16.
 */

function getInstance(sandbox, moduleId, point){
    return new Promise(function(resolve){
        sandbox.require(moduleId).then(function(instance){
            var utils = sandbox.get('duplex/utils');
            if(utils.isNullOrEmpty(point)) resolve(instance);
            else{
                var val = instance;
                var names = point.split('.');
                for (var i = 0, len = names.length; i < len; i++) {
                    var name = names[i];
                    val = val[name];
                    if (val === undefined)
                        break;
                }

                resolve(val);
            }
        });
    });
}

var service = {
    create: function(sandbox){
        var utils = sandbox.get('duplex/utils');
        var doozers = {};

        //Defines default doozers
        var commandDoozer = {
            buildItem: function(args){
                return new Promise(function(resolve, reject){
                    var codon = args.codon;//The current codon that is being built.
                    var props = codon.props;

                    var module = props['module'];
                    var parts = (props['point'] || '').split('|');
                    var point = utils.trim(parts[0]);
                    var module = (parts.length > 1) ? utils.trim(parts[1]) : props['module'];

                    if(utils.isNullOrEmpty(module)){
                        var err = "The module attribute isn't declared in Command node.";
                        reject(err);
                        return;
                    }

                    getInstance(sandbox, module, point)
                        .then(resolve)
                        .catch(reject);
                });
            }
        };

        var instance = {
            get: function(id){
                return doozers[id];
            },
            set: function(){
                var obj = arguments[0];
                if(arguments.length === 2){
                    var id = arguments[0],
                        doozer = arguments[1];

                    obj = {};
                    obj[id] = doozer;
                }

                for(var name in obj){
                    if(obj.hasOwnProperty(name)){
                        if(doozers[name])
                            throw Error('A doozer with same id is already registered.');
                        doozers[name] = obj[name];
                    }
                }

                return this;
            }
        };

        //registers default doozers
        instance.set('Command', commandDoozer);

        return instance;
    }
};

module.exports = service;