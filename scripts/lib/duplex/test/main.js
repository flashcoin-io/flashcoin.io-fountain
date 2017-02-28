var duplex = require('../duplex');
var myService = duplex({
    exports:{
        sayHello: function(msg){
            return 'Hello, ' + msg;
        },
        deep:{
            groups:{
                create: function(){
                    return external.deep.users.create();
                },
                edit: function(){
                    return new Promise(function(resolve){
                        resolve('edit group');
                    });
                }
            }
        },
        test: function(count){
            return new Promise(function(resolve, reject){
                setTimeout(function() {
                    var val = 1;
                    for(var i = 0; i < count; i++){
                        val += i;
                    }
                    
                    resolve(val);
                }, 0);
            });
        }
    },
    imports: {
        sayHello: function(msg){
            return new Promise(function(resolve, reject){
                resolve('Hello, this is a msg from main thread: ' + msg);
            });
        },
        deep:{
            users:{
                create: function(msg){
                    return 'Create user';
                }
            }
        }
    }
});

var input = document.getElementById('editor');
var btn = document.getElementById('test');
var log = document.getElementById('log');
btn.onclick = function(event){
    var val = input.value;
    var div = document.createElement('div');
    log.appendChild(div);
    div.innerHTML = val + ': ';
    myService.api.sayHello(val).then(function(msg){
        div.innerHTML = val + ': ' + msg;
    }).catch(function(err){
        div.innerHTML = val + ': ' + err;
    });
};
