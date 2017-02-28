/**
 * Created by kang on 1/30/16.
 */
var service = {
    create: function(sandbox){
        var evaluators = {};

        var instance = {
            get: function(id){
                return evaluators[id];
            },
            set: function(){
                var obj = arguments[0];
                if(arguments.length === 2){
                    var id = arguments[0],
                        evaluator = arguments[1];

                    obj = {};
                    obj[id] = evaluator;
                }

                for(var name in obj){
                    if(obj.hasOwnProperty(name)){
                        if(evaluators[name])
                            throw Error('An evaluator with same id is already registered.');
                        evaluators[name] = obj[name];
                    }
                }

                return this;
            }
        };

        return instance;
    }
};

module.exports = service;