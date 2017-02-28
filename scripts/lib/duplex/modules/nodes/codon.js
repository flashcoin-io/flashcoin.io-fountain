/**
 * Created by kang on 1/28/16.
 */

var Condition = require('./conditions.js').Condition;
var ConditionFailedAction = require('./conditions.js').ConditionFailedAction;

function doBuildItem(doozer, codon, data){
    var result = doozer.buildItem({codon: codon, data: data});
    return (result instanceof Promise) ? result : Promise.resolve(result);
}

module.exports = {
  create: function(sandbox, name, props, conditions){
      props = props || {};
      conditions = conditions || [];

      var codon =  {
          buildItem: function(data){
              var data = data || {};
              var doozers = sandbox.get('nodes').doozers;
              var doozer = doozers.get(name);

              if (!doozer) {
                  var err = "Doozer " + name + " not found! " + this.toString();
                  console.error(err);
                  return Promise.reject(err);
              }

              if (!doozer.handleConditions) {
                  var cons = (data.conditions) ? [].concat(conditions, data.conditions) : conditions;
                  return Condition.getFailedAction({ codon: codon, conditions: cons, data: data })
                      .then(function (action) {
                          if (action !== ConditionFailedAction.Nothing)
                              return Promise.resolve();
                          else
                              return doBuildItem(doozer, codon, data);
                      });
              } else {
                  return doBuildItem(doozer, codon, data);
              }
          }
      };

      Object.defineProperties(codon, {
          id: {
              get: function(){
                  return props['id'];
              }
          },
          props: {
              get: function(){
                  return props;
              }
          }
      });

      return codon;
  }
};