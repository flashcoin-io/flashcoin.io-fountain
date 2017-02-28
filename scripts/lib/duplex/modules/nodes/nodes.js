/**
 * Created by trungtrungkang on 1/28/16.
 */
var Node = require('./Node.js');
var XmlObject = require('./xml.js').XmlObject;
var NodeType = require('./xml.js').NodeType;
var DoozerService = require('./doozers.js');
var EvaluatorService = require('./evaluators.js');

module.exports = function (sandbox) {
    var root;//root node

    return {
        init: function(){
            root = Node.create(sandbox, '', null);//root node
            this.doozers = DoozerService.create(sandbox);
            this.evaluators = EvaluatorService.create(sandbox);

            sandbox.set('nodes', this);
        },
        /**
         * Gets a node at specified path.
         * @param {String} path The path of node
         * @param {Boolean} createNew Indicates creating new node if it doesn't exist. Default value is true.
         */
        get: function (path, createNew) {
            if (path[0] === '/') path = path.substr(1);
            return root.get(path, createNew);
        },
        /**
         * Imports nodes from xml string.
         * @param {String} xml
         */
        imports: function (xml) {
            var reader = XmlObject.parse(xml);
            while (reader.read()) {
                switch (reader.nodeType) {
                    case NodeType.Element:
                        if (reader.localName === 'path') {
                            var name = reader.attributes['name'];
                            var node = root.get(name);
                            node.read(reader, 'path');
                        }
                        break;
                }
            }
        }
    }
};

