/**
 * Created by kang on 1/29/16.
 */

var utils = require('./utils');

var NodeType = {
    None: -1,
    Element: 0,
    Attribute: 1,
    Text: 2,
    CDATA: 3,
    EntityReference: 4,
    Entity: 5,
    ProcessingInstruction: 6,
    Comment: 7,
    Document: 8,
    DocumentFragment: 9,
    Notation: 10,
    Whitespace: 11,
    SignificantWhitespace: 12,
    EndElement: 13,
    EndEntity: 14,
    XmlDeclaration: 15
};

function XmlReader(xmlString) {
    //public properties
    this.nodeType = null;
    this.localName = null;
    this.text = null;
    this.attributes = {};

    //private fields
    this.__pause = false;
    this.__content = xmlString;
    this.__len = xmlString.length;
    this.__nodeType = -1;
    this.__localName = null;
    this.__fullName = null;
    this.__curNode = null;
    this.__version = "1.0";
    this.__encoding = "UTF-8";
    this.__curPos = 0;
    this.__curAttributePos = -1;
    this.__isLoadAttributes = false;
    this.__isEmptyEndName = false;
    this.__elementText = [];
    this.__elementNames = [];
    this.__textStack = [];
    this.__tokens = {
        comments: ["<!--", "-->"],
        docType: ["<?DOCTYPE", ">"],
        declaration: ["<?xml", "?>"],
        instruction: ["<!", ">"],
        script: ["<script>", "</script>"]
    };
    this.__inScript = false;
    this.__attributes = [];
    this.__isReadAttributes = false;
    this.__line = 1;
    this.__col = 1;
}

XmlReader.prototype = {
    /**
     * @return {Boolean}
     */
    read: function () {
        if (this.__pause)
            return false;
        var i = this.__curPos;
        var len = this.__len;
        var c;
        var nc;
        var text = this.__content;
        if (this.__textStack.length > 0) {
            this.__elementText = this.__textStack[this.__textStack.length - 1];
        }
        while (i < len) {
            c = text.charAt(i);
            nc = text.charAt(i + 1);
            if (c == '<' && nc != '/') {
                if (nc == '!' || nc == '?') {
                    this.__elementText = [];
                    this.__setNextPos(i);
                    if (this.__isDeclaration())
                        this.__processDeclaration();
                    else if (this.__isComment())
                        this.__processComment();
                    else if (this.__isInstruction())
                        this.__processInstruction();
                    else
                        throw "Cannot understand node at line " + this.__line + ", col " + this.__col + ".";
                }
                else {
                    this.__textStack.push([]);
                    this.__setNextPos(i + 1);
                    this.__nodeType = NodeType.Element;
                    this.__readElementName();
                    this.__elementNames.push(this.__fullName);
                    this.__isReadAttributes = false;
                    this.__curAttributePos = this.__curPos;
                    this.__ignoreAttributes();
                    var lcName = this.getLocalName();
                    if (lcName != null && lcName.toLowerCase() == "script")
                        this.__processScript();
                    return true;
                }
            }
            else if ((c == '/' && nc == '>') || (c == '<' && nc == '/')) {
                this.__setNextPos(i + 2);
                this.__nodeType = NodeType.EndElement;
                if (nc == '>') {
                    this.__isEmptyEndName = true;
                }
                else {
                    this.__isEmptyEndName = false;
                    this.__readElementName();
                    this.__setNextPos(this.__curPos + 1);
                }
                if (this.__textStack.length > 0)
                    this.__elementText = this.__textStack.pop();
                return true;
            }
            else {
                if (c == '>') {
                    this.__setNextPos(this.__curPos + 1);
                    if (this.__nodeType === NodeType.EndElement) {
                        if (this.__textStack.length > 0)
                            this.__elementText = this.__textStack.pop();
                        if (this.__elementNames.length > 0)
                            this.__fullName = this.__elementNames.pop();
                    }
                }
                else {
                    this.__elementText.push(c); //read text.
                }
            }
            i++;
        }
        return false;
    },
    /**
     * @return {String}
     */
    getFullName: function () { return this.__fullName; },
    /**
     * @return {String}
     */
    getLocalName: function () {
        if (this.__fullName == null)
            return null;
        var pos = this.__fullName.indexOf(':');
        if (pos == -1)
            return this.__fullName;
        pos++;
        return this.__fullName.substr(pos);
    },
    /**
     * @return {Boolean}
     */
    hasAttributes: function () {
        if (this.__nodeType != NodeType.Element)
            return false;
        if (!this.__isLoadAttributes)
            this.__loadAttributes();
        return this.__attributes.length > 0;
    },
    /**
     * @return {Array}
     */
    getAttributes: function () {
        if (this.__nodeType != NodeType.Element)
            return [];
        if (!this.__isLoadAttributes)
            this.__loadAttributes();
        return this.__attributes;
    },
    pause: this.__pause,
    /**
     * @return {String}
     */
    getText: function () {
        return this.__elementText.join('');
    },
    /**
     * @private
     */
    __readElementName: function () {
        var pos = this.__ignoreWhitespaces(this.__curPos);
        this.__setNextPos(pos);
        var fullName = [];
        var ch;
        for (var i = this.__curPos; i < this.__len; i++) {
            ch = this.__content.charAt(i);
            if (ch == ' ' || ch == '\n' || ch == '\t' || ch == '/' || ch == '>') {
                this.__fullName = fullName.join('');
                pos = this.__ignoreWhitespaces(i);
                this.__setNextPos(pos);
                return;
            }
            else if (ch != '\r' && ch != '!') {
                fullName.push(ch);
                this.__setNextPos(i);
            }
        }
    },
    __ignoreAttributes: function () {
        if (this.__nodeType != NodeType.Element || this.__isReadAttributes)
            return;
        var i = this.__curAttributePos, len = this.__len;
        var ch, nch;
        do {
            ch = this.__content.charAt(i);
            nch = this.__content.charAt(i + 1);
            if ((nch == '>' && ch == '/') || ch == '>') {
                this.__setNextPos(i);
                return;
            }
            i++;
        }
        while (i < len);
    },
    /***@private*/
    __loadAttributes: function () {
        if (this.__nodeType != NodeType.Element || this.__isReadAttributes)
            return;
        this.__attributes = [];
        var i = this.__ignoreWhitespaces(this.__curAttributePos);
        var len = this.__len;
        var ch, nch;
        do {
            i = this.__nextAttribute(i);
            i = this.__ignoreWhitespaces(i);
            ch = this.__content.charAt(i);
            nch = this.__content.charAt(i + 1);
            if ((nch == '>' && ch == '/') || ch == '>')
                break;
        }
        while (i < len);
        this.__isReadAttributes = true;
        if (i > this.__curPos)
            this.__setNextPos(i);
    },
    /**@private*/
    __nextAttribute: function (start) {
        var i = start;
        var ch;
        //process attribute name
        var name = [];
        do {
            ch = this.__content.charAt(i);
            if([' ', '=', '/', '>', '/r', '/n', '/t'].indexOf(ch) !== -1)
                break;
            else {
                name.push(ch);
                i++;
            }
        }
        while (ch != '/' && ch != '>');
        i = this.__ignoreWhitespaces(i);
        if (name.length == 0)
            return i;
        ch = this.__content.charAt(i);
        if (ch != '=')
            throw "Error read attribute at line " + this.__line + ", col " + this.__col + ".";
        i++;
        //process attribute value
        var separate = null;
        var val = [];
        var nch;
        var len = this.__len;
        do {
            ch = this.__content.charAt(i);
            nch = this.__content.charAt(i + 1);
            if (ch == '"' || ch == '\'') {
                if (separate == null)
                    separate = ch;
                else if (ch === separate) {
                    i++;
                    break;
                }
                else
                    val.push(ch);
            }
            else if ((nch == '>' && ch == '/') || ch == '>')
                break;
            else
                val.push(ch);
            i++;
        }
        while (i < len);
        if (name.length == 0 && val.length > 0)
            throw "Error read attribute at line " + this.__line + ", col" + this.__col + ".";
        if (name.length > 0) {
            var _name = name.join('');
            var _val = val.join('');
            this.__attributes[_name] = _val;
        }
        return i;
    },
    /**
     * @private
     * @return {Number}
     */
    __ignoreWhitespaces: function (start) {
        var ch;
        for (var i = start; i < this.__len; i++) {
            ch = this.__content.charAt(i);
            if (utils.ws.indexOf(ch) == -1) return i;
        }
    },
    /**
     * @private
     */
    __isComment: function () {
        var token = this.__tokens.comments[0];
        var index = this.__curPos;
        var text = this.__content;
        for (var i = 1; i < token.length; i++) {
            index++;
            if (text.charAt(index) != token.charAt(i))
                return false;
        }
        return true;
    },
    /**
     * @private
     */
    __processComment: function () {
        var token = this.__tokens.comments[1];
        var index = this.__curPos;
        var len = this.__len;
        var found = false;
        var text = this.__content;
        while (index < len) {
            if (text.charAt(index) == token.charAt(0)) {
                found = true;
                for (var i = 1; i < token.length; i++) {
                    index++;
                    if (text.charAt(index) != token.charAt(i)) {
                        found = false;
                        break;
                    }
                }
                if (found) {
                    index++;
                    this.__setNextPos(index);
                    return;
                }
            }
            index++;
        }
    },
    /**
     * @private
     */
    __isDeclaration: function () {
        var token = this.__tokens.declaration[0];
        var index = this.__curPos;
        var text = this.__content;
        for (var i = 1; i < token.length; i++) {
            index++;
            if (text.charAt(index).toLowerCase() != token.charAt(i))
                return false;
        }
        return true;
    },
    /**
     * @private
     */
    __processDeclaration: function () {
        var token = this.__tokens.declaration[1];
        var index = this.__curPos;
        var len = this.__len;
        var found = false;
        var text = this.__content;
        var ch;
        while (index < len) {
            ch = text.charAt(index);
            if (ch == token.charAt(0) || ch.toLowerCase() == token.charAt(0)) {
                found = true;
                for (var i = 1; i < token.length; i++) {
                    index++;
                    ch = text.charAt(index);
                    if (ch != token.charAt(i) || ch.toLowerCase() != token.charAt(i)) {
                        found = false;
                        break;
                    }
                }
                if (found) {
                    index++;
                    this.__setNextPos(index);
                    return;
                }
            }
            index++;
        }
    },
    /**
     * @private
     */
    __isInstruction: function () {
        var token = this.__tokens.instruction[0];
        var index = this.__curPos;
        var text = this.__content;
        for (var i = 1; i < token.length; i++) {
            index++;
            if (text.charAt(index) != token.charAt(i))
                return false;
        }
        return true;
    },
    /**
     * @private
     */
    __processInstruction: function () {
        var token = this.__tokens.instruction[1];
        var index = this.__curPos;
        var len = this.__len;
        var found = false;
        var text = this.__content;
        while (index < len) {
            if (text.charAt(index) == token.charAt(0)) {
                found = true;
                for (var i = 1; i < token.length; i++) {
                    index++;
                    if (text.charAt(index) != token.charAt(i)) {
                        found = false;
                        break;
                    }
                }
                if (found) {
                    index++;
                    this.__setNextPos(index);
                    return;
                }
            }
            index++;
        }
    },
    /**
     * @private
     */
    __isScript: function () {
        var token = this.__tokens.script[0];
        var index = this.__curPos + 1;
        var text = this.__content;
        for (var i = 1; i < token.length; i++) {
            index++;
            if (text.charAt(index).toLowerCase() != token.charAt(i))
                return false;
        }
        return true;
    },
    /**
     * @private
     */
    __processScript: function () {
        var token = this.__tokens.script[1];
        var index = this.__curPos;
        index = this.__ignoreWhitespaces(index) + 1;
        var len = this.__len;
        var found = false;
        var text = this.__content;
        var textElement = this.__textStack[this.__textStack.length - 1];
        var quote = null;
        var ch;
        var j;
        while (index < len) {
            ch = text.charAt(index);
            if (ch == '\'' || ch == '\"') {
                if (quote == null)
                    quote = ch;
                else if (quote == ch)
                    quote = null;
            }

            if ((ch == token.charAt(0) || ch.toLowerCase() == token.charAt(0)) && quote == null) {
                found = true;
                for (var i = 1; i < token.length; i++) {
                    j = index + i;
                    ch = text.charAt(j);
                    if (ch != token.charAt(i) || ch.toLowerCase() != token.charAt(i)) {
                        found = false;
                        break;
                    }
                }
                if (found) {
                    this.__setNextPos(index);
                    return;
                }
                else {
                    index = j;
                }
            }
            textElement.push(ch);//read script content.
            index++;
        }
    },
    /**
     * @param {Number} pos
     */
    __setNextPos: function (pos) {
        if (pos <= this.__curPos) return;
        var step = pos - this.__curPos;
        for (var i = pos; i > this.__curPos; i--) {
            var ch = this.__content.charAt(i);
            if (ch == '\n') {
                this.__line++;
                this.__col = 1;
            } else {
                this.__col += step;
            }
        }
        this.__curPos = pos;
    }
};

Object.defineProperties(XmlReader.prototype, {
    nodeType: {
        get: function(){
            return this.__nodeType;
        }
    },
    localName: {
        get: function(){
            return this.getLocalName();
        }
    },
    attributes: {
        get: function(){
            return this.getAttributes();
        }
    },
    text:{
        get: function(){
            return this.getText();
        }
    }
});


module.exports = {
    XmlReader: XmlReader,
    NodeType: NodeType
};
