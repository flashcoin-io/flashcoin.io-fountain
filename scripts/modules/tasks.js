/**
 * Created by kang on 3/9/16.
 */
export default function(sandbox){
    return {
        init: function(){
            tasks.start();
            sandbox.set('tasks', tasks);
        }
    };
}

var _tasks = [];
var _registerTasks = [];
var tasks = {
    register: function(task){
        if(task.delay == null) task.delay = 500;
        task.count = 0;
        _registerTasks.push(task);
    },
    start: function(){
        this.processTasks();
        setInterval(this.processTasks.bind(this), 1);
    },
    processTasks: function(){
        for(var i = 0; i < _registerTasks.length; i++){
            var task = _registerTasks[i];
            var idx = _tasks.indexOf(task);
            if(idx != -1) _tasks.splice(idx, 1);
            _tasks.push(task);
        }
        _registerTasks = [];

        for(var i = 0; i < _tasks.length; i++){
            var task = _tasks[i];
            if(task.stop){
                _tasks.splice(i, 1);
                task = _tasks[i];
            }

            if(task) this.handleTask(task);
        }
    },
    handleTask: function(task){
        if(task.processing) return;

        if(task.count >= task.delay) {
            task.processing = true;
            var result = task.handler();
            if(result instanceof Promise){
                result.then(function(state){
                    this.processing = false;
                    this.count = 0;
                    if(state == 'stop') this.stop = true;
                }.bind(task));
            }
            else {
                task.processing = false;
                task.count = 0;
                if(result == 'stop') task.stop = true;
            }
        }
        else task.count++;
    }
};