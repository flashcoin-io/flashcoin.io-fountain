/**
 * Created by trungtrungkang on 1/28/16.
 */
var utils = require('./utils.js');
var Codon = require('./codon.js');
var Condition = require('./conditions.js').Condition;
var NodeType = require('./xml.js').NodeType;
var topologicalSort = require('./topological-sort');

var Node = {
    create: function(sandbox, name, parent){
        var codons = [];
        var childs = [];

        var instance = {
            name: name,
            parent: parent,
            codons: {
                find: function(id){
                    return utils.filter(codons, function(codon){
                        return codon.id === id;
                    })[0];
                },
                add: function(codon){
                    codons.push(codon);
                    return this;
                },
                each: function(fn, ctx){
                    return utils.each(codons, fn, ctx || this);
                },
                exports: function(){
                    return [].slice.call(codons);
                }
            },
            childs: {
                find: function(name){
                    return utils.filter(childs, function(node){
                        return node.name === name;
                    })[0];
                },
                add: function(name){
                    if(this.find(name)){
                        throw Error('A node with same name has already registered.');
                    }

                    var parent = instance;
                    var node = Node.create(sandbox, name, parent);
                    childs.push(node);
                    return node;
                },
                each: function(fn, ctx){
                    return utils.each(childs, fn, ctx || this);
                },
                exports: function(){
                    return [].slice.call(childs);
                }
            },
            /**
             * Gets a child node from the specified path.
             * @param {String} path
             * @param {Boolean} createNew
             */
            get: function(path, createNew){
                if(path[0] === '/') path = path.substr(1);
                var names = path.split('/');
                if(names.length === 0) return this;

                var node = this;//current node.
                for(var i = 0; i < names.length; i++){
                    var name = names[i];
                    if(name === '') continue;
                    var found = node.childs.find(name);
                    if(!found){
                        if(createNew !== false) node = node.childs.add(name);
                        else return null;
                    }
                    else node = found;
                }

                return node;
            },
            /**
             * Loads codons from xml reader.
             * @param {XmlObject} reader
             * @param {String} endElement
             */
            read: function(reader, endElement){
                var conditionStack = [];

                while (reader.read()) {
                    switch (reader.nodeType) {
                        case NodeType.EndElement:
                            if (reader.localName === "Condition" || reader.localName === "ComplexCondition") {
                                conditionStack.pop();
                            } else if (reader.localName === endElement) {
                                return;
                            }
                            break;
                        case NodeType.Element:
                            var elementName = reader.localName;
                            if (elementName === "Condition") {
                                conditionStack.push(Condition.read(reader, sandbox));
                            } else if (elementName === "ComplexCondition") {
                                conditionStack.push(Condition.readComplexCondition(reader, sandbox));
                            } else {
                                if (!this.childs._count)
                                    this.childs._count = 1;
                                else
                                    this.childs._count += 1;

                                var props = reader.attributes;
                                var id = props["id"];
                                if(!id) {
                                    id = "node_" + this.childs._count;
                                    props["id"] = id;
                                }
                                var codon = Codon.create(sandbox, elementName, props, utils.copy([], conditionStack));
                                this.codons.add(codon);

                                if (!reader.isEmptyElement) {
                                    var subNode = this.get(id);
                                    subNode.read(reader, elementName, sandbox);
                                } else {
                                    codon.content = reader.text;
                                    reader.read();//Move to end of element.
                                }
                            }
                            break;
                    }
                }
            },
            buildItems: function(data){
                data = data || {};
                var _codons = codons;
                if(data.doozer) {
                    _codons = utils.filter(codons, function(codon){
                        return codon.name === data.doozer;
                    });
                }
                _codons = topologicalSort.sort(_codons);

                var promises = _codons.map(function(codon){
                    return this.buildItem(codon, data);
                }.bind(this));

                return Promise.all(promises);
            },
            buildItem: function(codon, data){
                data = data || {};
                var id = codon.id;
                var subItemNode = this.childs.find(id);
                if(subItemNode) data.subItemNode = subItemNode;

                return new Promise(function(resolve, reject){
                    codon.buildItem(data).then(function(item){
                        resolve(item);
                    }).catch(function(err){
                        reject(err);
                    });
                });
            }
        };

        return instance;
    }
};

module.exports = Node;