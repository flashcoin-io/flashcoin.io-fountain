import riot from 'riot';

export default function(sandbox){
  return {
    init: function(){
      riot.tag('unity-app', '<yield/>', function(opts){
        controller.call(this, sandbox, opts);
      });

      riot.mount('unity-app');
    }
  };
}

function controller(sandbox, opts){
  
}
