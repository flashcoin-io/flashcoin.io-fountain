/**
 * Created by kang on 1/29/16.
 */
var utils = require('./utils.js');
var NodeType = require('./xml.js').NodeType;

//Conditions
var ConditionFailedAction = {
    Nothing: "nothing",
    Exclude: "exclude",
    Disable: "disable"
};

var Condition = {
    create: function(name, props, sandbox){
        return {
            name: name,
            props: props || {},
            action: props['action'] || ConditionFailedAction.Exclude,
            validate: function(args){
                return new Promise(function(resolve, reject){
                    var name = this.name;
                    var evaluators = sandbox.get('nodes').evaluators;
                    var evaluator = evaluators.get(name);

                    if (!evaluator){
                        var err = "Condition evaluator " + name + " not found!";
                        console.error(err);
                        reject(err);
                        return;
                    }

                    evaluator.validate(args).then(function(valid){
                        resolve(valid);
                    });
                });
            }
        };
    },
    /**
     * Builds condition from xml reader.
     * @param {XmlObject} reader
     * @param sandbox
     */
    read: function (reader, sandbox) {
        var props = utils.dom.attributes(reader.current);
        var name = props['name'];
        if (utils.isNullOrEmpty(name)) {
            var err = "The Condition node requires attribute 'name'.";
            console.error(err);
            throw new Error(err);
        }

        return Condition.create(name, props, sandbox);
    },
    /**
     * Loads complex conditions from xml reader.
     * @param {XmlObject} reader the xml reader.
     * @param {type} sandbox
     */
    readComplexCondition: function (reader, sandbox) {
        var condition;
        while (reader.read()) {
            var current = reader.current;
            var nodeType = reader.nodeType;
            var name = current.localName;

            switch (nodeType) {
                case NodeType.Element:
                    switch (name) {
                        case "And":
                            condition = AndCondition.read(reader, sandbox);
                            break;
                        case "Or":
                            condition = OrCondition.read(reader, sandbox);
                            break;
                        case "Not":
                            condition = NotCondition.read(reader, sandbox);
                            break;
                        default:
                            throw new Error("Invalid element name '" + name + "', the first entry in a ComplexCondition " +
                                "must be <And>, <Or> or <Not>");
                    }
            }
        }
    },
    readConditionList: function (reader, endElement, sandbox) {
        var conditions = [];
        while (reader.read()) {
            var current = reader.current;
            var nodeType = reader.nodeType;
            var name = current.localName;

            switch (nodeType) {
                case NodeType.EndElement:
                    if (name === endElement) {
                        return conditions;
                    }
                    break;
                case NodeType.Element:
                    switch (name) {
                        case "And":
                            conditions.push(AndCondition.read(reader, sandbox));
                            break;
                        case "Or":
                            conditions.push(OrCondition.read(reader, sandbox));
                            break;
                        case "Not":
                            conditions.push(NotCondition.read(reader, sandbox));
                            break;
                        case "Condition":
                            conditions.push(Condition.read(reader, sandbox));
                            break;
                        default:
                            throw new Error("Invalid element name '" + name + "', entries in a <" + endElement + "> " + "must be <And>, <Or>, <Not> or <Condition>");
                    }
                    break;
            }
        }

        return conditions;
    },
    getFailedAction: function (args) {
        return new Promise(function(resolve, reject){
            var action = ConditionFailedAction.Nothing;
            var conditionList = args.conditions;

            utils.async.each(conditionList, function (condition, i, next, finish) {
                condition.validate({codon: args.codon, data: args.data})
                    .then(function (valid) {
                        if (!valid) {
                            if (condition.action === ConditionFailedAction.Disable) {
                                action = ConditionFailedAction.Disable;
                                next();
                            } else {
                                action = ConditionFailedAction.Exclude;
                                finish();
                            }
                        } else
                            next();
                    })
                    .catch(function(err){
                        finish(err);
                    });
            }, function (err) {
                if(err) reject(err);
                else resolve(action);
            });
        });
    }

};

var AndCondition = {
    create: function(conditions){
        return {
            validate: function(args){
                return new Promise(function(resolve, reject){
                    var valid = true;
                    utils.async.each(conditions, function (condition, i, next, finish) {
                        condition.validate(args)
                            .then(function (isValid) {
                                if (!isValid) {
                                    valid = false;
                                    finish();
                                } else
                                    next();
                            })
                            .catch(function(err){
                                finish(err);
                            });
                    }, function (err) {
                        if(err) reject(err);
                        else resolve(valid);
                    });
                });
            }
        };
    },
    read: function(reader, sandbox){
        return this.create(Condition.readConditionList(reader, "And", sandbox));
    }
};

var NotCondition = {
    create: function(condition){
        return {
            validate: function(){
                var args = Array.prototype.slice.call(arguments);
                return new Promise(function(resolve){
                    condition.validate.apply(condition, args).then(function (isValid) {
                        resolve(!isValid);
                    });
                });
            }
        };
    },
    read: function(reader, sandbox){
        return this.create(Condition.readConditionList(reader, "Not", sandbox)[0]);
    }
};

var OrCondition = {
    create: function(conditions){
        return {
            validate: function(args){
                return new Promise(function(resolve, reject){
                    var valid = false;
                    utils.async.each(conditions, function (condition, i, next, finish) {
                            condition.validate(args)
                                .then(function (isValid) {
                                    if (isValid) {
                                        valid = true;
                                        finish();
                                    } else
                                        next();
                                })
                                .catch(function(err){
                                   finish(err);
                                });
                        },
                        function (err) {
                            if(err) reject(err);
                            else resolve(valid);
                        });
                });
            }
        };
    },
    read: function(reader, sandbox){
        return this.create(Condition.readConditionList(reader, "Or", sandbox))
    }
};

module.exports = {
    ConditionFailedAction: ConditionFailedAction,
    Condition: Condition,
    AndCondition: AndCondition,
    NotCondition: NotCondition,
    OrCondition: OrCondition
};

