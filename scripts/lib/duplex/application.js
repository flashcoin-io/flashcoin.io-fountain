var create_duplex = require('./duplex');
var Events = require('./events');
var utils = require('./utils');

var bus = new Events();
var modules = {};
var loadingModules = [];

var services = {
    bus: bus,
    'duplex/utils': utils
};

function Sandbox(data){
    this.data = data;
}
Sandbox.prototype = {
    get: function(name){
        return app.services.get.call(this, name);
    },
    set: function(){
        return app.services.set.apply(this, arguments);
    },
    require: function(id){
        return app.start(id);
    }
};

var app = {
    register: function () {
        var obj = arguments[0];
        if(arguments.length === 2){
            var moduleId = arguments[0], creator = arguments[1];
            obj = {};
            obj[moduleId] = creator;
        }

        for(var moduleId in obj){
            if(obj.hasOwnProperty(moduleId)){
                var creator = obj[moduleId];

                modules[moduleId] = {
                    creator: creator,
                    instance: null,
                    initialized: false
                };
            }
        }
    },
    start: function (moduleId) {
        var moduleItem = modules[moduleId];
        if(!moduleItem) throw new Error('Module ' + moduleId + ' is undefined.');

        if(moduleItem.initialized) {
            return Promise.resolve(moduleItem.instance);
        }

        if(moduleItem.promise) {//module is creating...
            return new Promise(function(resolve, reject){
                moduleItem.promise.then(resolve).catch(reject);
            });
        }

        moduleItem.creating = true;
        var promise = new Promise(function(resolve){
            console.log('module ' + moduleId + ' is loading...');
            loadingModules.push(moduleId);
            var instance = moduleItem.creator(new Sandbox({module: moduleId}));
            moduleItem.instance = instance;

            var result = null;
            if(instance.init){
                result = (function(instance){
                    try{
                        return instance.init();
                    }
                    catch(err){
                        return Promise.reject(err);
                    }
                })(instance);
            };

            if(!(result instanceof Promise)) result = Promise.resolve(result);

            result.then(function(){
                var idx = loadingModules.indexOf(moduleId);
                if(idx !== -1) loadingModules.splice(idx, 1);
                var msgs = ['Module ' + moduleId + ' is loaded.'];
                if(loadingModules.length) msgs.push('Remaining: ' + loadingModules.join(', '));
                console.log(msgs.join('\n'));
                moduleItem.creating = false;
                moduleItem.initialized = true;
                moduleItem.promise = null;

                resolve(moduleItem.instance);
            }).catch(function(err){
                throw err;
            });
        });

        moduleItem.promise = promise;
        return promise;
    },
    stop: function (moduleId) {
        var moduleItem = modules[moduleId];
        if (moduleItem.instance) {
            var instance = moduleItem.instance;
            moduleItem.instance = null;
            instance.destroy();
        }
    },
    startAll: function () {
        var promiseList = [];
        for (var moduleId in modules) {
            if (modules.hasOwnProperty(moduleId))
                promiseList.push(this.start(moduleId));
        }

        return Promise.all(promiseList);
    },
    stopAll: function () {
        for (var moduleId in modules) {
            if (modules.hasOwnProperty(moduleId))
                this.stop(moduleId);
        }
    },
    services:{
        set: function(){
            var obj = arguments[0];
            var force = false;
            if(arguments.length >= 2){
                var name = arguments[0], service = arguments[1];
                obj = {};
                obj[name] = service;
                force = arguments[2];
            }

            for(var name in obj){
                if(obj.hasOwnProperty(name)){
                    if(services[name] && !force) {
                        throw Error('The ' + name + ' service has already registered.');
                    }
                    services[name] = obj[name];
                }
            }
        },
        get: function(name){
            return services[name];
        }
    },
    modules:{
        get: function(id){
            return app.start(id);
        }
    },
    duplex: function(settings){
        return create_duplex(settings);
    }
};

module.exports = app;
