/**
 * Created by trungtrungkang on 1/28/16.
 */

var utils = require('./utils.js');
var xmldom = require('./lib/xmldom/dom-parser.js');

var NodeType = {
    Element: "Element",
    EndElement: "EndElement"
};

/**
 * An object allows visiting elements on XML document.
 * @param {Element} xnode
 */
function XmlObject(xnode) {
    if (xnode.nodeType === 9)
        xnode = this.children(xnode)[0];
    /**@type Element*/
    this.xnode = xnode;
    /**@type NodeType*/
    this.nodeType = null;
    /**@type Boolean*/
    this.isEOF = false;
    /**@type Element[]*/
    this._parents = [null];
    /**@type Element[]*/
    this._stack = [xnode];
    /**@type Element*/
    this.current = null;
}
XmlObject.prototype = {
    /**
     * Returns children of current node.
     * @param {Element} xnode The current node.
     */
    children: function (xnode) {
        if (xnode.children)
            return xnode.children;
        return utils.filter(xnode.childNodes, function (child) {
            return child.nodeType === 1;
        });
    },
    /**
     * Start visiting on the element.
     * @param {Element} item The element is going to begin visiting on.
     */
    start: function (item) {
        this.current = item;
        this.nodeType = NodeType.Element;
        this.localName = item.localName;

        var parent = item;
        this._parents.push(parent);
        this._stack.push(parent);

        var childs = this.children(item);
        var len = childs.length;
        this.isEmptyElement = (len === 0);
        for (var i = len - 1; i >= 0; i--) {
            this._stack.push(childs[i]);
            this._parents.push(parent);
        }
    },
    /**
     * Stop visiting on the element.
     * @param {Element} item The element is going to finish visiting on.
     */
    end: function (item) {
        this.current = item;
        this.nodeType = NodeType.EndElement;
        this.localName = item.localName;
        this.isEOF = this._stack.length === 0;
    },
    /**
     * Moves to next element.
     * @returns {Boolean} Returns false if we have no element to be visited anymore, otherwise returns true.
     */
    next: function () {
        if (this.isEOF)
            return false;

        var parent = this._parents.pop();
        var item = this._stack.pop();
        if (item !== parent) {
            this.start(item);
        } else {
            this.end(parent);
        }

        return true;
    },
    /**
     * Moves to next element.
     * @param {Function} fn The callback to handle whenever we reache an element.
     * @returns {Boolean} Returns false if we have no element to be visited anymore, otherwise returns true.
     */
    read: function (fn) {
        var result = this.next();
        if (fn)
            fn.call(this, this.current, this.nodeType, this.isEOF);
        return result;
    },
    /**
     * Moves current position to the specified element.
     * @param {String} name The element name need moving to.
     */
    moveTo: function (name) {
        while (this.read()) {
            switch (this.nodeType) {
                case NodeType.Element:
                    if (this.localName === name)
                        return true;
                    break;
            }
        }

        return false;
    },
    /**
     * Represents a xml document in string.
     */
    toString: function () {
        var xml = "";
        while (this.read()) {
            switch (this.nodeType) {
                case NodeType.Element:
                    var item = this.current;
                    xml += '<' + item.localName;
                    var attrs = [];
                    utils.each(item.attributes, function (attr) {
                        attrs.push(attr.nodeName + '="' + attr.nodeValue + '"');
                    });
                    if (attrs.length > 0)
                        xml += ' ' + attrs.join(' ');
                    xml += '>';
                    break;
                case NodeType.EndElement:
                    xml += '</' + item.localName + '>';
                    break;
            }
        }
        return xml;
    }
};

Object.defineProperties(XmlObject.prototype, {
    attributes: {
        get: function(){
            return utils.dom.attributes(this.current);
        }
    },
    text: {
        get: function(){
            return utils.dom.text(this.current);
        }
    }
});

/**
 * Parses xml string and returns an XmlObject instance.
 * @param {String} xml
 */
XmlObject.parse = function(xml){
    var parser = new xmldom.DOMParser();
    var doc = parser.parseFromString(xml);
    var root = doc.documentElement;
    return new XmlObject(root);
};

module.exports = {
    NodeType: NodeType,
    XmlObject: XmlObject
};