(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ClientIO = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    var Enum = require('../lib/client/web/browser/enum'),
        Config = {
            mode: Enum.Mode.PROD,

            Packet: {
                bufferSize: 64 * 1024
            },

            Socket: {
                protocol: Enum.ServerProtocol.HTTP,
                device: Enum.Socket.Device.WEB_SOCKET,
                host: 'localhost',
                port: 8098,
                maxConnectAttempts: 100,
                connectTimeoutSecs: 10,
                reconnectWaitSecs: 1,
                requestTimeoutSecs: 20
            },

            Pipe: {
                maxListeners: 2 * 1024,

                HeartBeat: {
                    intervalSecs: 30,
                    timeoutSecs: 0
                },

                BlobHandler: {
                    maxBlobSize: 21 * 1024 * 1024,
                    maxFileSize: 48 * 1024 * 1024,
                    chunkSize: 48 * 1024,
                    timeoutSecs: 20
                }
            },

            DataProtocol: {
                // protocol: Enum.DataProtocol.SIMPLE,
                protocol: Enum.DataProtocol.CURVE_ZMQ,
                CurveZMQ: {
                    bufferSize: 64 * 1024,
                    serverPublicKey: '5Jz3NhPHKUYP2JfU2n+xsT8Q5xC57yhhWa2Mdprva0A=',
                    publicKey: 'r4dHh2mSrijGSOK76k1DssBNcrjyGrV4LA9abowFTAk=',
                    secretKey: 'Uih8sq+XRSbQO4ySOs0a0WovV8YDdw28efPf+NPt9M4='
                }
            },

            MetaData: {
                idToken: null,
                sessionToken: null
            }
        }

    Config.Pipe.HeartBeat.timeoutSecs = Config.Pipe.HeartBeat.intervalSecs * 2 + 1;

    module.exports = Config;
},{"../lib/client/web/browser/enum":12}],2:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    var ClientIO = require('./index'),
        Enum = require('../../../common/enum');

    var Enum = {
        Mode: Enum.Mode,
        ServerProtocol: Enum.ServerProtocol,
        DataProtocol: Enum.DataProtocol,
        Device: {
            WEB_SOCKET: 'WEB_SOCKET',
            HTTP_LONG_POLL: 'HTTP_LONG_POLL'
        },
        Status: Enum.Pipe.Status,
        ResponseCode: Enum.Pipe.ResponseCode,
        Event: Enum.Pipe.Event
    };

    function API(config) {
        var components = {
            PacketHelper: require('./data/packet-helper'),
            BlobHandlers: require('./pipe/blob-handlers'),
            Pipe: require('./pipe'),
            Socket: require('./socket'),
            ProtocolAdaptor: require('./protocol-adaptor'),
            ClientRequest: require('./data/client-request'),
            ClientResponse: require('./data/client-response'),
            DataPacket: require('./data/data-packet')
        };

        return new ClientIO(config, Enum, components, true);
    };

    module.exports = API;
    module.exports.Enum = Enum;
},{"../../../common/enum":28,"./data/client-request":5,"./data/client-response":6,"./data/data-packet":8,"./data/packet-helper":11,"./index":14,"./pipe":21,"./pipe/blob-handlers":16,"./protocol-adaptor":23,"./socket":26}],3:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    var utf8 = require('tweetnacl').util,
        Enum = require('../enum').Blob,
        DataObject = require('./data-object');

    module.exports = Blob;

    function Blob() {}

    Blob.metadataLength = function(dataObjectCount) {
        return Enum.Offset.PACKET_LENGTH + Enum.Offset.DATA_OBJECT_METADATA * dataObjectCount;
    }

    Blob.toBlob = function(value) {
        var blobObject = DataObject.fromValue(value),
            blob = new Blob().startWrite(Blob.metadataLength(1) + blobObject.length());

        return blob.writeNext(blobObject).endWrite();
    }

    Blob.prototype.startRead = function(data) {
        if (!(data instanceof Uint8Array)) {
            throw ('Backing buffer needs to be type "Uint8Array":', DataObject.typeKey(data));
        }

        this.readBuffer = data;
        this.dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
        this.offset = 0;

        var packetLength = this.dataView.getUint32(this.offset)
        this.offset += Enum.Offset.PACKET_LENGTH;

        if (this.readBuffer.length !== packetLength) {
            throw ('Incomplete buffer:' + this.readBuffer.length + ', packet:' + packetLength)
        }

        return this;
    }

    Blob.prototype.readNext = function(readValue) {
        var dataObject = new DataObject(this.dataView.getInt8(this.offset++));

        if (dataObject.type !== Enum.ObjectType.UNKNOWN) {
            var length = this.readLength(dataObject);

            if (readValue) {
                switch (dataObject.type) {
                    case Enum.ObjectType.ARRAY:
                    case Enum.ObjectType.ARRAY_BUFFER:
                    case Enum.ObjectType.UINT8ARRAY:
                    case Enum.ObjectType.BUFFER:
                        dataObject._value = this.readBuffer.subarray(this.offset, this.offset + length);
                        break;

                    case Enum.ObjectType.BYTE:
                        dataObject._value = this.dataView.getInt8(this.offset);
                        break;

                    case Enum.ObjectType.SHORT_INTEGER:
                        dataObject._value = this.dataView.getUint16(this.offset);
                        break;

                    case Enum.ObjectType.INTEGER:
                        dataObject._value = this.dataView.getUint32(this.offset);
                        break;

                    case Enum.ObjectType.STRING:
                        dataObject._value = DataObject.readString(this.readBuffer, this.offset, length);
                        break;

                    case Enum.ObjectType.JSON:
                        dataObject._value = JSON.parse(DataObject.readString(this.readBuffer, this.offset, length));
                        break;
                }

            } else {
                dataObject._buffer = this.readBuffer.subarray(this.offset, this.offset + length);
            }

            this.offset += length;
        }

        return dataObject;
    }

    Blob.prototype.readLength = function(dataObject) {
        var length = 0;

        switch (dataObject.type) {
            case Enum.ObjectType.BYTE:
                length = 1;
                break;

            case Enum.ObjectType.SHORT_INTEGER:
                length = 2;
                break;

            case Enum.ObjectType.INTEGER:
                length = 4;
                break;

            case Enum.ObjectType.ARRAY:
            case Enum.ObjectType.ARRAY_BUFFER:
            case Enum.ObjectType.UINT8ARRAY:
            case Enum.ObjectType.BUFFER:
            case Enum.ObjectType.STRING:
            case Enum.ObjectType.JSON:
                length = this.dataView.getUint32(this.offset);
                this.offset += 4;
                break;
        }

        return length;
    }

    Blob.prototype.endRead = function() {
        this.readBuffer = null;
    }

    Blob.prototype.startWrite = function(bufferSize) {
        bufferSize = bufferSize || 64 * 1024;

        if (!this.writeBuffer || this.writeBuffer.length !== bufferSize) {
            var data = new Uint8Array(bufferSize);
            this.writeBuffer = data;
        }

        this.dataView = new DataView(this.writeBuffer.buffer);
        this.offset = Enum.Offset.PACKET_LENGTH;
        return this;
    }

    Blob.prototype.writeNext = function(dataObject) {
        var length = 0;

        this.dataView.setInt8(this.offset++, dataObject.type);

        if (dataObject.type !== Enum.ObjectType.UNKNOWN) {
            length = dataObject.length()
            this.writeLength(dataObject, length);

            if (dataObject._buffer) {
                this.writeBuffer.set(dataObject._buffer, this.offset);

            } else {
                switch (dataObject.type) {
                    case Enum.ObjectType.ARRAY:
                    case Enum.ObjectType.ARRAY_BUFFER:
                    case Enum.ObjectType.UINT8ARRAY:
                    case Enum.ObjectType.BUFFER:
                        this.writeBuffer.set(dataObject._value, this.offset);
                        break;

                    case Enum.ObjectType.BYTE:
                        this.dataView.setInt8(this.offset, dataObject._value);
                        break;

                    case Enum.ObjectType.SHORT_INTEGER:
                        this.dataView.setUint16(this.offset, dataObject._value);
                        break;

                    case Enum.ObjectType.INTEGER:
                        this.dataView.setUint32(this.offset, dataObject._value);
                        break;

                    case Enum.ObjectType.STRING:
                    case Enum.ObjectType.JSON:
                        this.writeBuffer.set(dataObject.stringValue(), this.offset);
                        break;
                }
            }

            this.offset += length;
        }

        return this;
    }

    Blob.prototype.writeLength = function(dataObject, length) {
        switch (dataObject.type) {
            case Enum.ObjectType.ARRAY:
            case Enum.ObjectType.ARRAY_BUFFER:
            case Enum.ObjectType.UINT8ARRAY:
            case Enum.ObjectType.BUFFER:
            case Enum.ObjectType.STRING:
            case Enum.ObjectType.JSON:
                this.dataView.setUint32(this.offset, length);
                this.offset += 4;
                break;
        }
    }

    Blob.prototype.endWrite = function() {
        this.dataView.setUint32(0, this.offset);
        var buffer = this.writeBuffer.subarray(0, this.offset);

        if (buffer.length !== this.offset) {
            throw ('Insufficient buffer:' + buffer.length + ', packet:' + this.offset);
        }
        return buffer;
    }
},{"../enum":12,"./data-object":7,"tweetnacl":29}],4:[function(require,module,exports){
    /**
     * Helper class for a array buffer backing usually by an Uint8Array
     */
    var utf8 = require('tweetnacl').util;

    function BufferView(buffer) {
        if (!(buffer instanceof Uint8Array)) {
            throw 'Backing buffer needs to be Uint8Array';
        }

        this.buffer = buffer;
        this.dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        this.rewind();
    }

    BufferView.prototype.data = function() {
        return this.buffer.slice(0, this.offset + 1);
    }

    BufferView.prototype.reset = function() {
        this.offset = this.mark;
    }

    BufferView.prototype.rewind = function() {
        this.offset = this.mark = 0;
    }

    BufferView.prototype.set = function(offset) {
        this.offset = offset;
    }

    BufferView.prototype.skip = function(s) {
        this.offset += s;
    }

    BufferView.prototype.mark = function() {
        this.mark = offset;
    }

    BufferView.prototype.length = function() {
        return this.buffer.byteLength;
    }

    BufferView.prototype.slice = function(start, end) {
        if (!end) {
            end = this.buffer.byteLength;
        }
        return this.buffer.subarray(start, end);
    }

    BufferView.prototype.readUInt8 = function(offset) {
        if (!offset) {
            var res = this.dataView.getUint8(this.offset, false);
            this.offset += 1;
            return res;
        } else {
            return this.dataView.getUint8(offset, false);
        }
    }

    BufferView.prototype.readInt8 = function(offset) {
        if (!offset) {
            var res = this.dataView.getInt8(this.offset, false);
            this.offset += 1;
            return res;
        } else {
            return this.dataView.getInt8(offset, false);
        }
    }

    BufferView.prototype.readUInt16 = function(offset) {
        if (!offset) {
            var res = this.dataView.getUint16(this.offset, false);
            this.offset += 2;
            return res;
        } else {
            return this.dataView.getUint16(offset, false);
        }
    }

    BufferView.prototype.readUInt32 = function(offset) {
        if (!offset) {
            var res = this.dataView.getUint32(this.offset, false);
            this.offset += 4;
            return res;
        } else {
            return this.dataView.getUint32(offset, false);
        }
    }

    BufferView.prototype.readInt32 = function(offset) {
        if (!offset) {
            var res = this.dataView.getInt32(this.offset, false);
            this.offset += 4;
            return res;
        } else {
            return this.dataView.getInt32(offset, false);
        }
    }

    BufferView.prototype.readSlice = function(length, offset) {
        if (!offset) {
            offset = this.offset
        }

        var value = this.buffer.subarray(offset, offset + length);
        this.offset += length;
        return value;
    }

    BufferView.prototype.writeUInt8 = function(value, offset) {
        if (!offset) {
            this.dataView.setUint8(this.offset, value);
            this.offset += 1;
        } else {
            this.dataView.setUint8(offset, value);
        }
    }

    BufferView.prototype.writeInt8 = function(value, offset) {
        if (!offset) {
            this.dataView.setInt8(this.offset, value);
            this.offset += 1;
        } else {
            this.dataView.setInt8(offset, value);
        }
    }

    BufferView.prototype.writeUInt16 = function(value, offset) {
        if (!offset) {
            this.dataView.setUint16(this.offset, value, false);
            this.offset += 2;
        } else {
            this.dataView.setUint16(offset, value, false);
        }
    }

    BufferView.prototype.writeUInt32 = function(value, offset) {
        if (!offset) {
            this.dataView.setUint32(this.offset, value, false);
            this.offset += 4;
        } else {
            this.dataView.setUint32(offset, value, false);
        }
    }

    BufferView.prototype.writeInt32 = function(value, offset) {
        if (!offset) {
            this.dataView.setInt32(this.offset, value, false);
            this.offset += 4;
        } else {
            this.dataView.setInt32(offset, value, false);
        }
    }

    /**
     * estimate the UTF8 array
     * @param string value
     * @returns the encoded UTF8 array
     */
    BufferView.decodeUTF8 = function(value) {
        return utf8.decodeUTF8(value);
    }

    BufferView.prototype.writeUTF8 = function(value, offset) {
        var a = utf8.decodeUTF8(value);
        var pos = (offset ? offset : this.offset);
        if (pos + a.byteLength > this.buffer.byteLength) {
            throw 'range error';
        }

        for (var i = 0; i < a.byteLength; i++) {
            this.buffer[pos + i] = a[i];
        }
        if (!offset) {
            this.offset += a.byteLength;
        }

        return a.byteLength;
    }

    BufferView.prototype.append = function(buf, offset) {
        if (!buf instanceof Uint8Array) {
            throw 'buffer needs to be Uint8Array';
        }

        var pos = (offset ? offset : this.offset)

        if (pos + buf.byteLength > this.buffer.byteLength) {
            throw 'range error';
        }

        this.buffer.set(buf, pos);
        if (!offset) {
            this.offset += buf.byteLength;
        }
    }

    BufferView.prototype.readUTF8 = function(length, offset) {
        var pos = (offset ? offset : this.offset);
        if (pos + length > this.buffer.byteLength) {
            throw 'range error';
        }

        var sub = this.buffer.subarray(pos, pos + length);
        var res = utf8.encodeUTF8(sub);
        if (!offset) {
            this.offset += length;
        }
        return res;
    }

    BufferView.prototype.fill = function(value, start, end) {
        var use_offset = false;
        if (!start) {
            start = 0;
            end = this.buffer.byteLength;
            use_offset = true;
        }

        for (var i = start; i < end; i++) {
            this.buffer[i] = value;
        }

        if (use_offset) {
            this.offset += (end - start);
        }
    }

    module.exports = BufferView;
},{"tweetnacl":29}],5:[function(require,module,exports){
    /*
     * @copyright sanjiv.bhalla@gmail.com
     *
     * Released under the MIT license
     */

    'option strict';

    var DataPacket = require('./data-packet'),
        Hops = require('./hops');

    module.exports = ClientRequest;

    ClientRequest.DataObject = DataPacket.DataObject;
    ClientRequest.Blob = DataPacket.Blob;

    function ClientRequest(command, flag, sequenceNo, param, payload, hops) {
        this.command = command;
        this.flag = flag;
        this.sequenceNo = sequenceNo;
        this.param = param;
        this.payload = payload;
        this.hops = hops || Hops.new();
    }

    ClientRequest.prototype.addHop = function(key) {
        Hops.addItem(this.hops, key);
    }

    ClientRequest.prototype.hopDuration = function(key, subKey) {
        return Hops.duration(this.hops, key, subKey);
    }

    ClientRequest.prototype.toWebSocketBuffer = function() {
        return this.toDataPacket().toWebSocketBuffer();
    }

    ClientRequest.prototype.toDataPacket = function() {
        return new DataPacket(
            this.command,
            this.flag,
            this.sequenceNo,
            this.param,
            this.payload,
            this.hops
        );
    }

    ClientRequest.fromWebSocketBuffer = function(buffer) {
        return ClientRequest.fromDataPacket(DataPacket.fromWebSocketBuffer(buffer));
    }

    ClientRequest.fromDataPacket = function(dataPacket) {
        return new ClientRequest(
            dataPacket.command(),
            dataPacket.flag(),
            dataPacket.sequenceNo(),
            dataPacket.payload1(),
            dataPacket.payload2(),
            dataPacket.hops()
        );
    }
},{"./data-packet":8,"./hops":9}],6:[function(require,module,exports){
    /*
     * @copyright sanjiv.bhalla@gmail.com
     *
     * Released under the MIT license
     */

    'option strict';

    var Enum = require('../enum'),
        DataPacket = require('./data-packet'),
        Hops = require('./hops');

    module.exports = ClientResponse;

    function ClientResponse(command, flag, sequenceNo, error, result, payload, hops) {
        this.command = command;
        this.flag = flag;
        this.sequenceNo = sequenceNo;

        if (error) this.error = error;
        if (result) this.result = result;
        if (payload) this.payload = payload;
        this.hops = hops || Hops.new();
    }

    ClientResponse.prototype.status = function() {
        return (this.error) ? Enum.Status.ERROR : Enum.Status.SUCCESS;
    }

    ClientResponse.prototype.hopDuration = function(key, subKey1, subKey2) {
        return Hops.duration(this.hops, key, subKey1, subKey2);
    }

    ClientResponse.prototype.hopTotalDuration = function(key, subKey1, subKey2) {
        return Hops.totalDuration(this.hops, key, subKey1, subKey2);
    }

    ClientResponse.prototype.event = function() {
        return this.command;

        /*
         var event = undefined;
         switch (this.flag) {
         case Enum.Packet.Client.Flag.RESPONSE:
         // event = this.sequenceNo;
         event = this.command;
         break;

         case Enum.Packet.Client.Flag.FORWARD_RESPONSE:
         case Enum.Packet.Client.Flag.INTERNAL_RESPONSE:
         event = this.command;
         break;
         }
         return event;
         */
    }

    ClientResponse.prototype.toWebSocketBuffer = function() {
        return this.toDataPacket().toWebSocketBuffer();
    }

    ClientResponse.prototype.toDataPacket = function() {
        var data = {
            error: this.error,
            result: this.result
        }

        return new DataPacket(
            this.command,
            this.flag,
            this.sequenceNo,
            data,
            this.payload,
            this.hops
        );
    }

    ClientResponse.fromWebSocketBuffer = function(buffer) {
        return ClientResponse.fromDataPacket(DataPacket.fromWebSocketBuffer(buffer));
    }

    ClientResponse.fromDataPacket = function(dataPacket) {
        var data = dataPacket.payload1() || {};

        return new ClientResponse(
            dataPacket.command(),
            dataPacket.flag(),
            dataPacket.sequenceNo(),
            data.error,
            data.result,
            dataPacket.payload2(),
            dataPacket.hops()
        );
    }
},{"../enum":12,"./data-packet":8,"./hops":9}],7:[function(require,module,exports){
    (function (Buffer){
        /*
         * @copyright unseen, ehf
         */

        'option strict';

        var utf8 = require('tweetnacl').util,
            Enum = require('../enum').Blob;

        module.exports = DataObject;

        function DataObject(type) {
            this.type = type;
            this._value = undefined;
            this._buffer = undefined;
            this._stringValue = undefined;
        }

        DataObject.type = function(value) {
            var type = Enum.ObjectType.UNKNOWN;

            if (!value) {
                type = Enum.ObjectType.UNKNOWN;

            } else if (value instanceof DataObject) {
                type = value.type();

            } else if ((value instanceof Array)) {
                type = Enum.ObjectType.ARRAY;

            } else if ((value instanceof ArrayBuffer)) {
                type = Enum.ObjectType.ARRAY_BUFFER;

            } else if ((value instanceof Uint8Array)) {
                type = Enum.ObjectType.UINT8ARRAY;

            } else if ((value instanceof Buffer)) {
                type = Enum.ObjectType.BUFFER;

            } else if (typeof(value) === 'number') {
                type = Enum.ObjectType.INTEGER;

            } else if (typeof(value) === 'string') {
                type = Enum.ObjectType.STRING;

            } else {
                type = Enum.ObjectType.JSON;
            }

            return type;
        }

        DataObject.typeKey = function(data) {
            var type = DataObject.type(data);
            return Enum.ObjectType.Key[type] || type;
        }

        DataObject.fromValue = function(value, type) {
            if (value instanceof DataObject) {
                return value;
            }

            var dataObject = new DataObject(type || Enum.ObjectType.UNKNOWN);
            if (dataObject.type === Enum.ObjectType.UNKNOWN) {
                dataObject.type = DataObject.type(value);
            }

            switch (dataObject.type) {
                case Enum.ObjectType.ARRAY:
                case Enum.ObjectType.ARRAY_BUFFER:
                case Enum.ObjectType.UINT8ARRAY:
                case Enum.ObjectType.BUFFER:
                    dataObject._value = value || new Uint8Array(0);
                    break;

                case Enum.ObjectType.BYTE:
                    dataObject._value = value || 0;
                    break;

                case Enum.ObjectType.SHORT_INTEGER:
                    dataObject._value = value || 0;
                    break;

                case Enum.ObjectType.INTEGER:
                    dataObject._value = value || 0;
                    break;

                case Enum.ObjectType.STRING:
                    dataObject._value = value || '';
                    break;

                case Enum.ObjectType.JSON:
                    dataObject._value = value || {};
                    break;
            }

            return dataObject;
        }

        DataObject.prototype.hasValue = function() {
            return (this.type !== Enum.ObjectType.UNKNOWN)
        };

        DataObject.prototype.value = function() {
            if (this._buffer) {
                var dataView = new DataView(this._buffer.buffer, this._buffer.byteOffset, this._buffer.byteLength);

                switch (this.type) {
                    case Enum.ObjectType.ARRAY:
                    case Enum.ObjectType.ARRAY_BUFFER:
                    case Enum.ObjectType.UINT8ARRAY:
                    case Enum.ObjectType.BUFFER:
                        this._value = this._buffer;
                        break;

                    case Enum.ObjectType.BYTE:
                        this._value = dataView.getInt8(0);
                        break;

                    case Enum.ObjectType.SHORT_INTEGER:
                        this._value = dataView.getUint16(0);
                        break;

                    case Enum.ObjectType.INTEGER:
                        this._value = dataView.getUint32(0);
                        break;

                    case Enum.ObjectType.STRING:
                        this._value = DataObject.readString(this._buffer);
                        break;

                    case Enum.ObjectType.JSON:
                        this._value = JSON.parse(DataObject.readString(this._buffer));
                        break;
                }

                this._buffer = null;
            }

            return this._value;
        }

        DataObject.prototype.length = function() {
            var length = 0;

            if (this.type !== Enum.ObjectType.UNKNOWN) {
                if (this._buffer) {
                    length = this._buffer.length;

                } else {
                    var bufferValue = undefined;
                    switch (this.type) {
                        case Enum.ObjectType.BYTE:
                            length = 1;
                            break;

                        case Enum.ObjectType.SHORT_INTEGER:
                            length = 2;
                            break;

                        case Enum.ObjectType.INTEGER:
                            length = 4;
                            break;

                        case Enum.ObjectType.ARRAY:
                        case Enum.ObjectType.ARRAY_BUFFER:
                        case Enum.ObjectType.UINT8ARRAY:
                        case Enum.ObjectType.BUFFER:
                            length = this._value.length;
                            break;

                        case Enum.ObjectType.STRING:
                        case Enum.ObjectType.JSON:
                            length = this.stringValue().byteLength;
                            break;
                    }
                }
            }

            return length;
        }

        DataObject.prototype.stringValue = function() {
            if (!this._stringValue) {
                switch (this.type) {
                    case Enum.ObjectType.STRING:
                        this._stringValue = utf8.decodeUTF8(this._value);
                        break;

                    case Enum.ObjectType.JSON:
                        this._stringValue = utf8.decodeUTF8(JSON.stringify(this._value));
                        break;
                }
            }

            return this._stringValue;
        }

        DataObject.readString = function(buffer, offset, length) {
            offset = offset || 0;
            length = length || buffer.length;
            return utf8.encodeUTF8(buffer.subarray(offset, offset + length));
        }
    }).call(this,require("buffer").Buffer)
},{"../enum":12,"buffer":31,"tweetnacl":29}],8:[function(require,module,exports){
    /*
     * @copyright sanjiv.bhalla@gmail.com
     *
     * Released under the MIT license
     */

    'option strict';

    var Enum = require('../enum'),
        Blob = require('./blob'),
        Hops = require('./hops'),
        DataObject = require('./data-object');

    module.exports = DataPacket;

    DataPacket.DataObject = DataObject;
    DataPacket.Blob = Blob;

    function DataPacket(command, flag, sequenceNo, payload1, payload2, hops) {
        this._commandObject = DataObject.fromValue(command || Enum.Internal.Command.Client.INVALID_COMMAND, Enum.Blob.ObjectType.STRING);
        this._flagObject = DataObject.fromValue(flag, Enum.Blob.ObjectType.BYTE);
        this._sequenceNoObject = DataObject.fromValue(sequenceNo, Enum.Blob.ObjectType.INTEGER);
        this._payload1Object = DataObject.fromValue(payload1);
        this._payload2Object = DataObject.fromValue(payload2);
        this._hopsObject = DataObject.fromValue(hops || Hops.new(), Enum.Blob.ObjectType.JSON);
        this.payloadIsBlob = false;
    }

    DataPacket.prototype.command = function() {
        return this._commandObject.value();
    }

    DataPacket.prototype.flag = function() {
        return this._flagObject.value();
    }

    DataPacket.prototype.sequenceNo = function() {
        return this._sequenceNoObject.value();
    }

    DataPacket.prototype.payload1 = function() {
        return this._payload1Object.value();
    }

    DataPacket.prototype.payload2 = function() {
        return this._payload2Object.value();
    }

    DataPacket.prototype.setPayload2 = function(value, isBlob) {
        this._payload2Object = DataObject.fromValue(value);
        this.payloadIsBlob = isBlob || false;
    }

    DataPacket.prototype.hops = function() {
        return this._hopsObject.value();
    }

// hops
    DataPacket.prototype.addHop = function(key) {
        this._hopsObject._value = Hops.addItem(this.hops(), key);
    }

    DataPacket.prototype.hopDuration = function(key) {
        this.hops();
        return Hops.duration(this._hopsObject._value, key);
    }

    DataPacket.prototype.updateHopDuration = function(key) {
        this._hopsObject._value = Hops.updateDuration(this.hops(), key);
    }

    DataPacket.prototype._getBufferSize = function() {
        var length = Blob.metadataLength(6);
        length += this._commandObject.length();
        length += this._flagObject.length();
        length += this._sequenceNoObject.length();
        length += this._payload1Object.length();
        length += this._payload2Object.length();
        length += this._hopsObject.length();
        return length;
    }

// buffer
    DataPacket.fromWebSocketBuffer = function(buffer) {
        var blob = new Blob();
        blob.startRead(buffer);

        var commandObject = blob.readNext(true),
            flagObject = blob.readNext(true),
            sequenceNoObject = blob.readNext(true),
            payload1Object = blob.readNext(true),
            payload2Object = blob.readNext(true),
            hopsObject = blob.readNext(true);

        blob.endRead();

        return new DataPacket(
            commandObject,
            flagObject,
            sequenceNoObject,
            payload1Object,
            payload2Object,
            hopsObject);
    }

    DataPacket.prototype.toWebSocketBuffer = function() {
        var blob = new Blob(this._getBufferSize());
        blob.startWrite();
        blob.writeNext(this._commandObject);
        blob.writeNext(this._flagObject);
        blob.writeNext(this._sequenceNoObject);
        blob.writeNext(this._payload1Object);
        blob.writeNext(this._payload2Object);
        blob.writeNext(this._hopsObject);
        return blob.endWrite();
    }
},{"../enum":12,"./blob":3,"./data-object":7,"./hops":9}],9:[function(require,module,exports){
    /*
     * @copyright sanjiv.bhalla@gmail.com
     *
     * Released under the MIT license
     */

    'option strict';

    function elapsedMillisecs(startTime) {
        return Math.floor(Date.now() - startTime);
    }

    module.exports = Hops;

    function Hops(key) {
        if (key) {
            return {
                key: Date.now()
            };

        } else {
            return {};
        }
    };

    Hops.new = function(key) {
        return new Hops(key);
    }

    Hops.addItem = function(hops, key) {
        hops[key] = Date.now();
        return hops;
    }

    Hops.removeItem = function(hops, key) {
        delete hops[key];
        return hops;
    }

    var computeDuration = function(hops, key) {
        var ms = hops[key];
        if (ms) {
            if (ms > 10000) {
                ms = elapsedMillisecs(ms);
                hops[key] = ms;
            }
            return ms;
        }
        return 0;
    }

    Hops.updateDuration = function(hops, key) {
        computeDuration(hops, key)
        return hops;
    }

    Hops.duration = function(hops, key, subKey1, subKey2) {
        var duration = 0;

        if (subKey1) {
            duration = computeDuration(hops, key) - computeDuration(hops, subKey1);
            if (subKey2) {
                duration = duration - computeDuration(hops, subKey2);
            }

        } else {
            duration = computeDuration(hops, key);
        }

        return duration;
    }

    Hops.totalDuration = function(hops, key, subKey1, subKey2) {
        var duration = 0;

        if (subKey1) {
            duration = computeDuration(hops, key) + computeDuration(hops, subKey1);
            if (subKey2) {
                duration = duration + computeDuration(hops, subKey2);
            }

        } else {
            duration = computeDuration(hops, key);
        }

        return duration;
    }

    Hops.toJson = function(hops) {
        return JSON.stringify(hops);
    }

    Hops.fromJson = function(jsonString) {
        return JSON.parse(jsonString);
    }
},{}],10:[function(require,module,exports){
    /*
     * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
     * Digest Algorithm, as defined in RFC 1321.
     * Copyright (C) Paul Johnston 1999 - 2000.
     * Updated by Greg Holt 2000 - 2001.
     * See http://pajhome.org.uk/site/legal.html for details.
     */

    'option strict';

    /*
     * Convert a 32-bit number to a hex string with ls-byte first
     */
    var hex_chr = "0123456789abcdef";

    function rhex(num) {
        str = "";
        for (j = 0; j <= 3; j++)
            str += hex_chr.charAt((num >> (j * 8 + 4)) & 0x0F) +
                hex_chr.charAt((num >> (j * 8)) & 0x0F);
        return str;
    }

    /*
     * Convert a string to a sequence of 16-word blocks, stored as an array.
     * Append padding bits and the length, as described in the MD5 standard.
     */
    function str2blks_MD5(str) {
        nblk = ((str.length + 8) >> 6) + 1;
        blks = new Array(nblk * 16);
        for (i = 0; i < nblk * 16; i++) blks[i] = 0;
        for (i = 0; i < str.length; i++)
            blks[i >> 2] |= str.charCodeAt(i) << ((i % 4) * 8);
        blks[i >> 2] |= 0x80 << ((i % 4) * 8);
        blks[nblk * 16 - 2] = str.length * 8;
        return blks;
    }

    /*
     * Add integers, wrapping at 2^32. This uses 16-bit operations internally
     * to work around bugs in some JS interpreters.
     */
    function add(x, y) {
        var lsw = (x & 0xFFFF) + (y & 0xFFFF);
        var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xFFFF);
    }

    /*
     * Bitwise rotate a 32-bit number to the left
     */
    function rol(num, cnt) {
        return (num << cnt) | (num >>> (32 - cnt));
    }

    /*
     * These functions implement the basic operation for each round of the
     * algorithm.
     */
    function cmn(q, a, b, x, s, t) {
        return add(rol(add(add(a, q), add(x, t)), s), b);
    }

    function ff(a, b, c, d, x, s, t) {
        return cmn((b & c) | ((~b) & d), a, b, x, s, t);
    }

    function gg(a, b, c, d, x, s, t) {
        return cmn((b & d) | (c & (~d)), a, b, x, s, t);
    }

    function hh(a, b, c, d, x, s, t) {
        return cmn(b ^ c ^ d, a, b, x, s, t);
    }

    function ii(a, b, c, d, x, s, t) {
        return cmn(c ^ (b | (~d)), a, b, x, s, t);
    }

    /*
     * Take a string and return the hex representation of its MD5.
     */
    function md5(str) {
        x = str2blks_MD5(str);
        a = 1732584193;
        b = -271733879;
        c = -1732584194;
        d = 271733878;

        for (i = 0; i < x.length; i += 16) {
            olda = a;
            oldb = b;
            oldc = c;
            oldd = d;

            a = ff(a, b, c, d, x[i + 0], 7, -680876936);
            d = ff(d, a, b, c, x[i + 1], 12, -389564586);
            c = ff(c, d, a, b, x[i + 2], 17, 606105819);
            b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
            a = ff(a, b, c, d, x[i + 4], 7, -176418897);
            d = ff(d, a, b, c, x[i + 5], 12, 1200080426);
            c = ff(c, d, a, b, x[i + 6], 17, -1473231341);
            b = ff(b, c, d, a, x[i + 7], 22, -45705983);
            a = ff(a, b, c, d, x[i + 8], 7, 1770035416);
            d = ff(d, a, b, c, x[i + 9], 12, -1958414417);
            c = ff(c, d, a, b, x[i + 10], 17, -42063);
            b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
            a = ff(a, b, c, d, x[i + 12], 7, 1804603682);
            d = ff(d, a, b, c, x[i + 13], 12, -40341101);
            c = ff(c, d, a, b, x[i + 14], 17, -1502002290);
            b = ff(b, c, d, a, x[i + 15], 22, 1236535329);

            a = gg(a, b, c, d, x[i + 1], 5, -165796510);
            d = gg(d, a, b, c, x[i + 6], 9, -1069501632);
            c = gg(c, d, a, b, x[i + 11], 14, 643717713);
            b = gg(b, c, d, a, x[i + 0], 20, -373897302);
            a = gg(a, b, c, d, x[i + 5], 5, -701558691);
            d = gg(d, a, b, c, x[i + 10], 9, 38016083);
            c = gg(c, d, a, b, x[i + 15], 14, -660478335);
            b = gg(b, c, d, a, x[i + 4], 20, -405537848);
            a = gg(a, b, c, d, x[i + 9], 5, 568446438);
            d = gg(d, a, b, c, x[i + 14], 9, -1019803690);
            c = gg(c, d, a, b, x[i + 3], 14, -187363961);
            b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
            a = gg(a, b, c, d, x[i + 13], 5, -1444681467);
            d = gg(d, a, b, c, x[i + 2], 9, -51403784);
            c = gg(c, d, a, b, x[i + 7], 14, 1735328473);
            b = gg(b, c, d, a, x[i + 12], 20, -1926607734);

            a = hh(a, b, c, d, x[i + 5], 4, -378558);
            d = hh(d, a, b, c, x[i + 8], 11, -2022574463);
            c = hh(c, d, a, b, x[i + 11], 16, 1839030562);
            b = hh(b, c, d, a, x[i + 14], 23, -35309556);
            a = hh(a, b, c, d, x[i + 1], 4, -1530992060);
            d = hh(d, a, b, c, x[i + 4], 11, 1272893353);
            c = hh(c, d, a, b, x[i + 7], 16, -155497632);
            b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
            a = hh(a, b, c, d, x[i + 13], 4, 681279174);
            d = hh(d, a, b, c, x[i + 0], 11, -358537222);
            c = hh(c, d, a, b, x[i + 3], 16, -722521979);
            b = hh(b, c, d, a, x[i + 6], 23, 76029189);
            a = hh(a, b, c, d, x[i + 9], 4, -640364487);
            d = hh(d, a, b, c, x[i + 12], 11, -421815835);
            c = hh(c, d, a, b, x[i + 15], 16, 530742520);
            b = hh(b, c, d, a, x[i + 2], 23, -995338651);

            a = ii(a, b, c, d, x[i + 0], 6, -198630844);
            d = ii(d, a, b, c, x[i + 7], 10, 1126891415);
            c = ii(c, d, a, b, x[i + 14], 15, -1416354905);
            b = ii(b, c, d, a, x[i + 5], 21, -57434055);
            a = ii(a, b, c, d, x[i + 12], 6, 1700485571);
            d = ii(d, a, b, c, x[i + 3], 10, -1894986606);
            c = ii(c, d, a, b, x[i + 10], 15, -1051523);
            b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
            a = ii(a, b, c, d, x[i + 8], 6, 1873313359);
            d = ii(d, a, b, c, x[i + 15], 10, -30611744);
            c = ii(c, d, a, b, x[i + 6], 15, -1560198380);
            b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
            a = ii(a, b, c, d, x[i + 4], 6, -145523070);
            d = ii(d, a, b, c, x[i + 11], 10, -1120210379);
            c = ii(c, d, a, b, x[i + 2], 15, 718787259);
            b = ii(b, c, d, a, x[i + 9], 21, -343485551);

            a = add(a, olda);
            b = add(b, oldb);
            c = add(c, oldc);
            d = add(d, oldd);
        }
        return rhex(a) + rhex(b) + rhex(c) + rhex(d);
    }

    module.exports = md5;
},{}],11:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    var Blob = require('./blob'),
        DataObject = require('./data-object'),
        Enum = require('../enum').Blob;

    module.exports = PacketHelper;

    function PacketHelper(bufferSize) {
        this.bufferSize = bufferSize;
        this.blob = new Blob();
    }

    PacketHelper.prototype.readPipe = function(data) {
        this.blob.startRead(data);

        var result = {
            version: this.blob.readNext(true).value(),
            command: this.blob.readNext(true).value(),
            flag: this.blob.readNext(true).value(),
            seqNo: this.blob.readNext(true).value(),
            extension: this.blob.readNext(true).value(),
            payload: this.blob.readNext(true).value()
        };
        this.blob.endRead();

        return result;
    }

    PacketHelper.prototype.writePipe = function(version, command, flag, seqNo, extension, payload) {
        this.blob.startWrite(this.bufferSize);

        this.blob.writeNext(DataObject.fromValue(version, Enum.ObjectType.BYTE));
        this.blob.writeNext(DataObject.fromValue(command, Enum.ObjectType.SHORT_INTEGER));
        this.blob.writeNext(DataObject.fromValue(flag, Enum.ObjectType.BYTE));
        this.blob.writeNext(DataObject.fromValue(seqNo, Enum.ObjectType.INTEGER));
        this.blob.writeNext(DataObject.fromValue(extension));
        this.blob.writeNext(DataObject.fromValue(payload));

        var buffer = this.blob.endWrite();
        return buffer;
    }

    PacketHelper.prototype.readHttpLongPoll = function(data) {
        this.blob.startRead(data);

        var result = {
            command: this.blob.readNext(true).value(),
            flag: this.blob.readNext(true).value(),
            id: this.blob.readNext(true).value(),
            message: this.blob.readNext(true).value()
        };
        this.blob.endRead();

        return result;
    }

    PacketHelper.prototype.writeHttpLongPoll = function(command, flag, id, message) {
        this.blob.startWrite(this.bufferSize);

        this.blob.writeNext(DataObject.fromValue(command, Enum.ObjectType.SHORT_INTEGER));
        this.blob.writeNext(DataObject.fromValue(flag, Enum.ObjectType.BYTE));
        this.blob.writeNext(DataObject.fromValue(id, Enum.ObjectType.STRING));
        this.blob.writeNext(DataObject.fromValue(message));

        return this.blob.endWrite();
    }

    PacketHelper.prototype.readMetaData = function(data) {
        this.blob.startRead(data);

        var result = {
            idToken: this.blob.readNext(true).value(),
            sessionToken: this.blob.readNext(true).value(),
        };
        this.blob.endRead();

        return result;
    }

    PacketHelper.prototype.writeMetaData = function(idToken, sessionToken) {
        this.blob.startWrite(this.bufferSize);

        this.blob.writeNext(DataObject.fromValue(idToken, Enum.ObjectType.STRING));
        this.blob.writeNext(DataObject.fromValue(sessionToken, Enum.ObjectType.STRING));

        return this.blob.endWrite();
    }
},{"../enum":12,"./blob":3,"./data-object":7}],12:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    var Enum = require('../../../common/enum');

    module.exports = {
        Mode: Enum.Mode,
        Status: Enum.Status,
        ServerProtocol: Enum.ServerProtocol,
        DataProtocol: Enum.DataProtocol,
        Socket: {
            Device: {
                WEB_SOCKET: 'WEB_SOCKET',
                HTTP_LONG_POLL: 'HTTP_LONG_POLL'
            },

            KEEP_ALIVE: true,
            HTTPLongPoll: Enum.Socket.HTTPLongPoll
        },
        CurveZMQ: Enum.CurveZMQ,
        Pipe: Enum.Pipe,
        Packet: Enum.Packet,
        Blob: Enum.Blob,
        ResponseCode: Enum.Pipe.ResponseCode,
        Event: Enum.Pipe.Event
    };
},{"../../../common/enum":28}],13:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    module.exports = Error;

    function Error(code, message) {
        this.code = code || '*unknown*';
        this.message = message || '*unknown*';
    }

    Error.new = function(data) {
        try {
            var message = data.message.replace(/{(\d+)}/g, function(match, number) {
                return (typeof data.param[number] != 'undefined') ? data.param[number] : match;
            });
            return new Error(data.code, message);

        } catch (error) {
            return new Error();
        }
    }
},{}],14:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    var Enum = require('./enum'),
        defaultConfig = require('../../../../config/client'),
        Error = require('./error'),
        md5 = require('./data/md5');


    module.exports = IOClient;

    function IOClient(config, IOEnum, Components, webAPI) {
        this.config = defaultConfig;
        this.Enum = IOEnum;
        this.Components = Components;
        this.webAPI = webAPI;

        try {
            if (window.location.hostname) this.config.Socket.host = window.location.hostname;
            if (window.location.port) this.config.Socket.port = window.location.port;
        } catch (error) {}

        if (config) {
            if (config.mode) this.config.mode = config.mode;
            if (config.serverProtocol) this.config.Socket.protocol = config.serverProtocol;
            if (config.dataProtocol) this.config.DataProtocol.protocol = config.dataProtocol;
            if (config.device) this.config.Socket.device = config.device;
            if (config.host) this.config.Socket.host = config.host;
            if (config.port) this.config.Socket.port = config.port;
            if (config.serverPublicKey) this.config.DataProtocol.CurveZMQ.serverPublicKey = config.serverPublicKey;
            if (config.clientPublicKey) this.config.DataProtocol.CurveZMQ.publicKey = config.clientPublicKey;
            if (config.clientSecretKey) this.config.DataProtocol.CurveZMQ.secretKey = config.clientSecretKey;
            if (config.sessionToken) this.config.MetaData.sessionToken = config.sessionToken;
            if (config.idToken) this.config.MetaData.idToken = config.idToken;
        }

        this.commandSequenceMap = {};
        this.sequenceNo = 0;
    }

    IOClient.prototype.start = function(callback) {
        var self = this;

        this.socket = new this.Components.Socket(this.config.Socket, this.webAPI);
        this.protocolAdaptor = this.Components.ProtocolAdaptor.newAdaptor(this.config.DataProtocol, this.config.MetaData);
        this.pipe = new this.Components.Pipe(this.config.Pipe, {
            PacketHelper: this.Components.PacketHelper,
            DataPacket: this.Components.DataPacket,
            ClientRequest: this.Components.ClientRequest,
            ClientResponse: this.Components.ClientResponse,
            BlobHandlers: this.Components.BlobHandlers
        });

        if (this.Components.log) {
            this.log = this.Components.log;

        } else {
            var Log = require('./log');
            this.log = new Log(this.config);
            this.log.start(this.pipe);
        }

        var listeners = {
            Socket: {
                open: this.protocolAdaptor.open.bind(this.protocolAdaptor),
                onClose: this.protocolAdaptor.onClose.bind(this.protocolAdaptor),
                receive: this.protocolAdaptor.receive.bind(this.protocolAdaptor),
                log: this.log
            },

            ProtocolAdaptor: {
                open: this.pipe.open.bind(this.pipe),
                onClose: this.pipe.onClose.bind(this.pipe),
                close: this.socket.close.bind(this.socket),
                send: this.socket.send.bind(this.socket),
                forward: this.pipe.receive.bind(this.pipe),
                log: this.log
            },

            Pipe: {
                close: this.socket.close.bind(this.socket),
                send: this.protocolAdaptor.send.bind(this.protocolAdaptor),
                receiveResponse: this.receiveResponse.bind(this),
                log: this.log
            }
        };

        this.packetHelper = new this.Components.PacketHelper(this.config.Packet.bufferSize);
        this.pipe.start(this.packetHelper, listeners.Pipe);
        this.protocolAdaptor.start(listeners.ProtocolAdaptor, this.packetHelper);
        this.socket.start(this.packetHelper, listeners.Socket);

        this.pipe.on('open', function() {
            callback(Enum.Pipe.Status.CONNECTION_OPENED, {
                pipeId: self.pipe.id
            });
        });

        this.pipe.on('close', function() {
            callback(Enum.Pipe.Status.CONNECTION_CLOSED, {
                pipeId: self.pipe.id
            });
        })

        return this;
    };

    IOClient.prototype.md5 = function(value) {
        return md5(value);
    }

    IOClient.prototype.ready = function() {
        return this.pipe.ready();
    }

    IOClient.prototype.sendRequest = function(command, param, payload, callback) {
        this._sendRequest(Enum.Packet.Client.Flag.REQUEST, command, param, payload, callback);
    }

    IOClient.prototype.sendBlobRequest = function(command, param, payload, callback, percentCallback) {
        this._sendRequest(Enum.Packet.Client.Flag.BLOB_REQUEST, command, param, payload, callback, percentCallback);
    }

    IOClient.prototype.sendFileRequest = function(command, param, payload, callback, percentCallback) {
        this._sendRequest(Enum.Packet.Client.Flag.FILE_REQUEST, command, param, payload, callback, percentCallback);
    }

    IOClient.prototype._sendRequest = function(flag, command, param, payload, callback, percentCallback) {
        if (callback) {
            var self = this;

            this.pipe.delegate.removeAllListeners(this.commandSequenceMap[command]);
            this.commandSequenceMap[command] = ++this.sequenceNo;

            this.once(command, function(error, result, payload, roundTripTime, serverLatency) {
                self.log.trace('[IOClient]', 'receiveResponse:' + result);
                callback(error, result, payload, roundTripTime, serverLatency);
            });

            var clientRequest = new this.Components.ClientRequest(command, flag, this.sequenceNo, param, payload);
            clientRequest.addHop(Enum.Packet.Hop.CLIENT);

            this.pipe.sendRequest(clientRequest, percentCallback);

        } else {
            this.log.error('[IOClient]', 'Callback for api is invalid.');
        }
    }

    IOClient.prototype.receiveResponse = function(clientResponse) {
        var error = (clientResponse.error) ? Error.new(clientResponse.error) : null;

        this.pipe.delegate.emit(
            clientResponse.event(),
            error,
            clientResponse.result,
            clientResponse.payload,
            clientResponse.hopDuration(Enum.Packet.Hop.CLIENT),
            clientResponse.hopDuration(Enum.Packet.Hop.SERVER)
        );
    }

    IOClient.prototype.once = function(event, callback) {
        var listener = function() {
            if (timerId) clearTimeout(timerId);

            if (arguments.length > 0) {
                callback.apply(this, arguments);

            } else {
                callback();
            }
        };
        this.pipe.delegate.once(event, listener);

        var self = this,
            timerId = setTimeout(function() {
                self.pipe.delegate.removeListener(event, listener);
                timerId = null;

                callback(Enum.ResponseCode.ERROR_TIMEOUT);
            }, this.config.Socket.requestTimeoutSecs * 1000);
    }

    IOClient.prototype.addListener = function(event, callback) {
        this.on(event, callback);
    }

    IOClient.prototype.on = function(event, callback) {
        if (callback) {
            var listener = function() {
                if (arguments.length > 0) {
                    callback.apply(this, arguments);

                } else {
                    callback();
                }
            };

            this.pipe.delegate.removeAllListeners(event);
            this.pipe.delegate.on(event, listener);

        } else {
            this.log.error('[IOClient]', 'Callback for listener is invalid.');
        }
    }

// IOClient.prototype.removeListener = function(event, callback) {
// 	this.pipe.delegate.removeListener(event, callback);
// };

// IOClient.prototype.removeAllListeners = function(event) {
// 	this.pipe.delegate.removeAllListeners(event);
// };
},{"../../../../config/client":1,"./data/md5":10,"./enum":12,"./error":13,"./log":15}],15:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    var Enum = require('./enum');

    module.exports = Log;

    function Log(config) {
        this.config = config;
    }

    Log.prototype.start = function(pipe) {
        this.pipe = pipe;
    }

    Log.prototype.error = function(source, message, code) {
        this.pipe.error(source, message, code);

        if (this.config.Mode === Enum.Mode.DEV) {
            if (code) {
                console.log('[Error] %s: (code %d) %s', source, code, message);

            } else {
                console.log('[Error] %s: %s', source, message);
            }
        }
    }

    Log.prototype.trace = function(source, message) {
        if (this.config.mode === Enum.Mode.DEV) {
            console.log('[Trace] %s: %s', source, message);
        }
    }
},{"./enum":12}],16:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    var FileSender = require('./file-sender'),
        FileReceiver = require('./file-receiver'),
        BlobSender = require('./blob-sender'),
        BlobReceiver = require('./blob-receiver'),
        Enum = require('../enum');

    module.exports = BlobHandlers;

    function BlobHandlers(config, packetHelper) {
        this.config = config;
        this.packetHelper = packetHelper;

        this.blobListeners = {
            log: {
                trace: this.trace.bind(this),
                error: this.error.bind(this)
            },
            close: this.close.bind(this)
        };

        this.items = {};
        this.count = 0;
    }

    BlobHandlers.prototype.item = function(id, silent) {
        var handler = this.items[id];
        if (handler) {
            return handler;

        } else {
            if (!silent) {
                this.error('Sender/receiver does not exist:' + id);
            }
        }
    };

    BlobHandlers.prototype.trace = function(id, message) {
        // console.log(id, message);
    };

    BlobHandlers.prototype.error = function(id, error) {
        this.close(id);
        console.log(id + ' error:' + error);
    };

    BlobHandlers.prototype.close = function(id) {
        this.trace('close', this.count);
        var handler = this.item(id);
        if (handler) {
            delete this.items[id];
            this.count--;
            this.trace('count', this.count);
        }
    };

    BlobHandlers.prototype.abort = function(id) {
        var handler = this.item(id);
        if (handler) {
            handler.abort();
            delete this.items[id];
            this.count--;
        }
    };

    BlobHandlers.prototype.startSender = function(dataPacket, pipeListeners, callback) {
        var id = BlobHandlers.UUID(),
            sender = this.item(id, true);

        if (!sender) {
            switch (dataPacket.flag()) {
                case Enum.Packet.Client.Flag.BLOB_REQUEST:
                case Enum.Packet.Client.Flag.BLOB_RESPONSE:
                case Enum.Packet.Client.Flag.FORWARD_BLOB_RESPONSE:
                    sender = new BlobSender(this.config, id, this.packetHelper, this.blobListeners, pipeListeners, callback);
                    break;

                case Enum.Packet.Client.Flag.FILE_REQUEST:
                case Enum.Packet.Client.Flag.FILE_RESPONSE:
                    sender = new FileSender(this.config, id, this.packetHelper, this.blobListeners, pipeListeners, callback);
                    break;

                default:
                    log.error('Client request flag is invalid:' + dataPacket.flag());
                    return;
                    break;
            }

            this.items[id] = sender;
            this.count++;
            sender.start(dataPacket);

        } else {
            log.error('Blob sender with ID "' + id + '" exists');
        }
    }

    BlobHandlers.prototype.sendNextChunk = function(id, seqenceNo) {
        var sender = this.item(id);
        if (sender) {
            sender.nextChunk(id, seqenceNo);
        }
    };

    BlobHandlers.prototype.endSender = function(id) {
        var sender = this.items[id];
        if (sender) {
            sender.end();
        }
    };

    BlobHandlers.prototype.newFileReceiver = function(pipeListeners, callback) {
        var id = BlobHandlers.UUID(),
            fileReceiver = this.item(id, true);

        if (!fileReceiver) {
            fileReceiver = new FileReceiver(this.config, this.packetHelper, this.blobListeners, pipeListeners, callback);
            this.items[id] = fileReceiver;
            this.count++;
            fileReceiver.start(id);
            return id;

        } else {
            log.error('File receiver with ID "' + id + '" exists');
        }
    };

    BlobHandlers.prototype.newBlobReceiver = function(pipeListeners, callback) {
        var id = BlobHandlers.UUID(),
            blobReceiver = this.item(id, true);

        if (!blobReceiver) {
            blobReceiver = new BlobReceiver(this.config, this.packetHelper, this.blobListeners, pipeListeners, callback);
            this.items[id] = blobReceiver;
            this.count++;
            blobReceiver.start(id);
            return id;

        } else {
            log.error('File receiver with ID "' + id + '" exists');
        }
    };

    BlobHandlers.prototype.startReceiver = function(id, dataPacket, pipeListeners, callback) {
        var blobReceiver = this.item(id, true);
        if (!blobReceiver) {
            switch (dataPacket.flag()) {
                case Enum.Packet.Client.Flag.BLOB_REQUEST:
                case Enum.Packet.Client.Flag.BLOB_RESPONSE:
                case Enum.Packet.Client.Flag.FORWARD_BLOB_RESPONSE:
                    blobReceiver = new BlobReceiver(this.config, this.packetHelper, this.blobListeners, pipeListeners, callback);
                    break;

                case Enum.Packet.Client.Flag.FILE_REQUEST:
                case Enum.Packet.Client.Flag.FILE_RESPONSE:
                    blobReceiver = new FileReceiver(this.config, this.packetHelper, this.blobListeners, pipeListeners, callback);
                    break;

                default:
                    log.error('Client request flag is invalid:' + dataPacket.flag());
                    break;
            }

            this.items[id] = blobReceiver;
            this.count++;
        }

        blobReceiver.start(id, dataPacket);
    };

    BlobHandlers.prototype.receiveNextChunk = function(id, seqenceNo, chunkSize, chunk) {
        var receiver = this.item(id);
        if (receiver) {
            receiver.nextChunk(id, seqenceNo, chunkSize, chunk);
        }
    };

    BlobHandlers.prototype.endReceiver = function(id, callback) {
        var receiver = this.item(id);
        if (receiver) {
            receiver.end(callback);
        }
    };

    BlobHandlers.UUID = function() {
        var now = Date.now(),
            uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(char) {
                var rnd = (now + Math.random() * 16) % 16 | 0;
                now = Math.floor(now / 16);
                return (char == 'x' ? rnd : (rnd & 0x3 | 0x8)).toString(16);
            });
        return uuid;
    };
},{"../enum":12,"./blob-receiver":17,"./blob-sender":18,"./file-receiver":19,"./file-sender":20}],17:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    var DataObject = require('../data/data-object'),
        Blob = require('../data/blob'),
        Enum = require('../enum');

    module.exports = BlobReceiver;

    function BlobReceiver(config, packetHelper, listeners, pipeListeners, callback) {
        this.config = config;
        this.packetHelper = packetHelper;
        this.listeners = listeners;
        this.pipeListeners = pipeListeners;
        this.callback = callback;
    }

    /*
     dataPacket: {
     param: {
     context: {
     size:
     }
     }
     payload: null
     }
     */
    BlobReceiver.prototype.start = function(id, dataPacket) {
        this.id = id;
        this.dataPacket = dataPacket;

        if (this.dataPacket) {
            switch (this.dataPacket.flag()) {
                case Enum.Packet.Client.Flag.FILE_RESPONSE:
                    this.context = this.dataPacket.payload1().result.file;
                    break;

                case Enum.Packet.Client.Flag.BLOB_REQUEST:
                case Enum.Packet.Client.Flag.BLOB_RESPONSE:
                case Enum.Packet.Client.Flag.FORWARD_BLOB_RESPONSE:
                    this.context = this.dataPacket.payload2();
                    break;
            }

            if (this.context.size > this.config.maxBlobSize) {
                this.error('Blob is larger than the maximum allowed size.');
                return;
            }

            this.blob = new Uint8Array(this.context.size);

            this.seqNo = 0;
            this.offset = 0;
            this.balance = this.context.size;

            this.send(Enum.Pipe.Command.START_TRANSFER, true, this.extension());
        }
    };

    BlobReceiver.prototype.nextChunk = function(id, seqNo, chunkSize, chunk) {
        this.listeners.log.trace('nextChunk:' + id + ':' + seqNo);
        var self = this;

        if (id !== this.id) {
            this.error('ID mismatch:' + id + ':' + this.id);
            return;
        }

        if (seqNo !== this.seqNo + 1) {
            this.error('Sequence mismatch:' + seqNo + ':' + (this.seqNo + 1));
            return;
        }

        if (chunkSize !== chunk.length) {
            this.error('Chunk size mismatch:' + chunkSize + ':' + chunk.length);
            return;
        }

        this.blob.set(chunk, this.offset);

        this.offset += chunkSize;
        this.balance -= chunkSize;

        this.send(Enum.Pipe.Command.TRANSFER, true, this.extension());
        if (this.callback) this.callback(null, this.result());
    };

    BlobReceiver.prototype.error = function(error) {
        this.listeners.log.trace('error');

        this.send(Enum.Pipe.Command.TRANSFER_ERROR, false, this.extension());
        if (this.callback) this.callback(error, this.result(error));

        this.stopTimeout();
        this.listeners.error(this.id, error);
    };

    BlobReceiver.prototype.end = function(callback, getBlob) {
        this.listeners.log.trace('end');

        this.send(Enum.Pipe.Command.END_TRANSFER, true, this.extension());

        switch (this.dataPacket.flag()) {
            case Enum.Packet.Client.Flag.BLOB_REQUEST:
            case Enum.Packet.Client.Flag.BLOB_RESPONSE:
            case Enum.Packet.Client.Flag.FORWARD_BLOB_RESPONSE:
                if (!getBlob) {
                    this.blob = new Blob().startRead(this.blob).readNext(true);
                }

                this.dataPacket.setPayload2(this.blob, getBlob);
                break;

            case Enum.Packet.Client.Flag.FILE_RESPONSE:
                this.dataPacket.setPayload2(this.blob);
                break;
        }

        this.stopTimeout();
        this.listeners.close(this.id);
        if (callback) callback(this.result());
    };

    BlobReceiver.prototype.abort = function() {
        this.listeners.log.trace('abort');

        this.stopTimeout();
        if (this.callback) this.callback('Operation aborted', this.result(true));
    };

    BlobReceiver.prototype.percentComplete = function() {
        if (this.context.size) {
            return ((this.offset / this.context.size) * 100).toFixed(1);
        }
    };

    BlobReceiver.prototype.extension = function() {
        return {
            id: this.id
        };
    };

    BlobReceiver.prototype.result = function(error) {
        var result = {
            id: this.id,
            percent: this.percentComplete()
        };

        if (error) {
            result.context = this.context;

        } else if (this.balance === 0) {
            result.dataPacket = this.dataPacket;
        }

        return result;
    };

    BlobReceiver.prototype.send = function(command, acknowledge, extension, payload) {
        var flag = (acknowledge) ? Enum.Packet.IO.Flag.ACKNOWLEDGE : Enum.Packet.IO.Flag.NONE;

        this.pipeListeners.send(this.packetHelper.writePipe(Enum.Pipe.EVP_VER, command, flag, ++this.seqNo, extension, payload));

        switch (command) {
            case Enum.Pipe.Command.START_TRANSFER:
            case Enum.Pipe.Command.TRANSFER:
                this.stopTimeout();
                this.startTimeout();
                break;

            case Enum.Pipe.Command.TRANSFER_ERROR:
            case Enum.Pipe.Command.END_TRANSFER:
                this.stopTimeout();
                break;
        }
    };

    BlobReceiver.prototype.stopTimeout = function() {
        this.listeners.log.trace('stopTimeout');
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
            this.timeoutTimer = undefined;
        }
    };

    BlobReceiver.prototype.startTimeout = function() {
        this.listeners.log.trace('startTimeout');
        if (!this.timeoutTimer) {
            var self = this;

            this.timeoutTimer = setTimeout(function() {
                self.timeoutTimer = undefined;
                self.error('Timeout at offset:' + self.offset, self.result(true));
            }, this.config.timeoutSecs * 1000);
        }
    };
},{"../data/blob":3,"../data/data-object":7,"../enum":12}],18:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    var DataObject = require('../data/data-object'),
        Blob = require('../data/blob'),
        Enum = require('../enum');

    module.exports = BlobSender;

    function BlobSender(config, id, packetHelper, listeners, pipeListeners, callback) {
        this.config = config;
        this.id = id;
        this.packetHelper = packetHelper;
        this.listeners = listeners;
        this.pipeListeners = pipeListeners;
        this.callback = callback;
    }

    BlobSender.prototype.toBlob = function(payload) {
        var blobObject = DataObject.fromValue(payload),
            blob = new Blob().startWrite(Blob.metadataLength(1) + blobObject.length());

        blob.writeNext(blobObject);
        return blob.endWrite();
    }

    /*
     dataPacket: {
     param: {
     context: {
     size:
     }
     }
     payload: blob
     }
     */
    BlobSender.prototype.start = function(dataPacket) {
        this.listeners.log.trace('BlobSender', 'start');

        this.blob = this.toBlob(dataPacket.payload2());
        this.context = {
            size: this.blob.length
        };
        if (this.context.size > this.config.maxBlobSize) {
            this.listeners.close('Blob is larger than the maximum allowed size.');
            return;
        }

        this.dataPacket = dataPacket;
        this.dataPacket.setPayload2(this.context);

        this.seqNo = 0;
        this.offset = 0;
        this.balance = this.context.size;

        this.send(Enum.Pipe.Command.START_TRANSFER, false, this.extension(true), this.dataPacket.toWebSocketBuffer());
    };

    BlobSender.prototype.nextChunk = function(id, seqNo) {
        this.listeners.log.trace('BlobSender', 'nextChunk');

        if (id !== this.id) {
            this.error('ID mismatch:' + id + ':' + this.id);
            return;
        }

        if (seqNo !== this.seqNo) {
            this.error('Sequence mismatch:' + seqNo + ':' + this.seqNo);
            return;
        }

        if (this.balance > 0) {
            this.chunkSize = Math.min(this.config.chunkSize, this.balance);
            var blobChunk = this.blob.subarray(this.offset, this.offset + this.chunkSize);

            this.offset += this.chunkSize;
            this.balance -= this.chunkSize;

            this.send(Enum.Pipe.Command.TRANSFER, false, this.extension(false, true), blobChunk);
            if (this.callback) this.callback(null, this.result());

        } else {
            this.send(Enum.Pipe.Command.END_TRANSFER, false, this.extension());
        }
    };

    BlobSender.prototype.error = function(error) {
        this.send(Enum.Pipe.Command.TRANSFER_ERROR, false, this.extension());
        if (this.callback) this.callback(error, this.result(error));

        this.stopTimeout();
        this.listeners.error(this.id, error);

        this.blob = null;
    };

    BlobSender.prototype.end = function() {
        this.stopTimeout();

        this.listeners.log.trace('BlobSender', 'end:' + this.id);
        this.listeners.close(this.id);

        if (this.callback) this.callback(null, this.result());
        this.blob = null;
    };

    BlobSender.prototype.abort = function() {
        this.listeners.log.trace('BlobSender', 'abort');

        this.stopTimeout();
        if (this.callback) this.callback('Operation aborted', this.result(true));
        this.blob = null;
    };

    BlobSender.prototype.percentComplete = function() {
        if (this.context.size) {
            return ((this.offset / this.context.size) * 100).toFixed(1);
        }
    };

    BlobSender.prototype.extension = function(includeContext, includeChunkSize) {
        var value = {
            id: this.id,
        };

        if (includeContext) value.context = this.context;
        if (includeChunkSize) value.chunkSize = this.chunkSize;

        return value;
    };

    BlobSender.prototype.result = function(error) {
        var result = {
            id: this.id,
            percentComplete: this.percentComplete()
        };

        if (error || (this.balance === 0)) {
            result.context = this.context;
        }

        return result;
    };

    BlobSender.prototype.send = function(command, acknowledge, extension, payload) {
        var flag = (acknowledge) ? Enum.Packet.IO.Flag.ACKNOWLEDGE : Enum.Packet.IO.Flag.NONE;

        this.pipeListeners.send(this.packetHelper.writePipe(Enum.Pipe.EVP_VER, command, flag, ++this.seqNo, extension, payload));

        switch (command) {
            case Enum.Pipe.Command.START_TRANSFER:
            case Enum.Pipe.Command.TRANSFER:
            case Enum.Pipe.Command.END_TRANSFER:
                this.stopTimeout();
                this.startTimeout();
                break;

            case Enum.Pipe.Command.TRANSFER_ERROR:
                this.stopTimeout();
                break;
        }
    };

    BlobSender.prototype.stopTimeout = function() {
        this.listeners.log.trace('BlobSender', 'stopTimeout');
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
            this.timeoutTimer = undefined;
        }
    };

    BlobSender.prototype.startTimeout = function() {
        this.listeners.log.trace('BlobSender', 'startTimeout');
        if (!this.timeoutTimer) {
            var self = this;

            this.timeoutTimer = setTimeout(function() {
                self.timeoutTimer = undefined;
                self.error('Timeout at offset:' + self.offset);
            }, this.config.timeoutSecs * 1000);
        }
    };
},{"../data/blob":3,"../data/data-object":7,"../enum":12}],19:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    var Enum = require('../enum');

    module.exports = FileReceiver;

    function FileReceiver(config, packetHelper, listeners, callback) {
        this.config = config;
        this.packetHelper = packetHelper;
        this.listeners = listeners;
        if (!this.callback) this.callback = callback;
    }

    /*
     clientRequest: {
     param: {
     context: {
     name:
     size:
     type:

     fileBuffer:
     }
     }
     }
     */
    FileReceiver.prototype.start = function(id, clientRequest) {
        this.id = id;

        if (clientRequest) {
            this.context = clientRequest.param.blobContext;
            if (this.context.size > this.config.maxFileSize) {
                this.error('File is larger than the maximum allowed size.');
                return;
            }

            this.clientRequest = clientRequest;
            this.openWriter();
            this.send(Enum.Pipe.Command.START_TRANSFER, true, this.extension());
        }
    }

    FileReceiver.prototype.openWriter = function() {
        this.listeners.log.trace('FileReceiver', 'openWriter');

        this.seqNo = 0;
        this.offset = 0;
        this.balance = this.context.size;

        this.context.fileBuffer = new Uint8Array(this.context.size);
    }

    FileReceiver.prototype.closeWriter = function(error, callback) {
        this.listeners.log.trace('FileReceiver', 'closeWriter');
    }

    FileReceiver.prototype.nextChunk = function(id, seqNo, chunkSize, chunk) {
        this.listeners.log.trace('FileReceiver', 'nextChunk:' + id + ':' + seqNo);

        if (id !== this.id) {
            this.error('ID mismatch:' + id + ':' + this.id);
            return;
        }

        if (seqNo !== this.seqNo + 1) {
            this.error('Sequence mismatch:' + seqNo + ':' + (this.seqNo + 1));
            return;
        }

        if (chunkSize !== chunk.length) {
            this.error('Chunk size mismatch:' + chunkSize + ':' + chunk.length);
            return;
        }

        try {
            this.context.fileBuffer.set(chunk, this.offset);
            this.offset += chunkSize;
            this.balance -= chunkSize;

            this.send(Enum.Pipe.Command.TRANSFER, true, this.extension());
            if (this.callback) this.callback(null, this.result());

        } catch (error) {
            this.error('Chunk:' + error.message);
        }
    }

    FileReceiver.prototype.error = function(error) {
        this.listeners.log.error('FileReceiver', 'error:' + error);

        this.send(Enum.Pipe.Command.TRANSFER_ERROR, false, this.extension());
        if (this.callback) this.callback(error, this.result(error));

        this.stopTimeout();
        this.closeWriter();

        this.listeners.error(this.id, error);
    }

    FileReceiver.prototype.end = function() {
        this.listeners.log.trace('FileReceiver', 'end');

        this.send(Enum.Pipe.Command.END_TRANSFER, true, this.extension());

        this.stopTimeout();
        this.closeWriter();

        this.listeners.close(this.id);
        if (this.callback) this.callback(error, this.result());
    }

    FileReceiver.prototype.abort = function() {
        this.listeners.log.trace('FileReceiver', 'abort');

        this.stopTimeout();
        this.closeWriter();

        if (this.callback) this.callback('Operation aborted', this.result(true));
    }

    FileReceiver.prototype.percentComplete = function() {
        if (this.context) {
            return ((this.offset / this.context.size) * 100).toFixed(1);
        }
    }

    FileReceiver.prototype.extension = function() {
        return {
            id: this.id
        };
    }

    FileReceiver.prototype.result = function(error) {
        var result = {
            id: this.id,
            percentComplete: this.percentComplete()
        }

        if (error) {
            result.context = this.context;

        } else if (this.balance === 0) {
            result.clientRequest = this.clientRequest;
        }

        return result;
    }

    FileReceiver.prototype.send = function(command, acknowledge, extension, payload) {
        var flag = (acknowledge) ? Enum.Packet.IO.Flag.ACKNOWLEDGE : Enum.Packet.IO.Flag.NONE;

        this.listeners.send(this.packetHelper.writePipe(Enum.Pipe.EVP_VER, command, flag, ++this.seqNo, extension, payload));

        switch (command) {
            case Enum.Pipe.Command.START_TRANSFER:
            case Enum.Pipe.Command.TRANSFER:
                this.stopTimeout();
                this.startTimeout();
                break;

            case Enum.Pipe.Command.TRANSFER_ERROR:
            case Enum.Pipe.Command.END_TRANSFER:
                this.stopTimeout();
                break;
        }
    }

    FileReceiver.prototype.stopTimeout = function() {
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
            this.timeoutTimer = null;
        }
    }

    FileReceiver.prototype.startTimeout = function() {
        if (!this.timeoutTimer) {
            var self = this;

            this.timeoutTimer = setTimeout(function() {
                self.error('Timeout at offset:' + self.offset);
                self.timeoutTimer = null;
            }, this.config.timeoutSecs * 1000);
        }
    }
},{"../enum":12}],20:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    var Enum = require('../enum');

    module.exports = FileSender;

    function FileSender(config, id, packetHelper, listeners, callback) {
        this.config = config;
        this.id = id;
        this.packetHelper = packetHelper;
        this.listeners = listeners;
        this.callback = callback;
    }

    /*
     clientRequest: {
     param: {
     file:
     }
     }
     */
    FileSender.prototype.start = function(dataPacket, file) {
        this.listeners.log.trace('FileSender', 'start');
        var self = this,
            param = dataPacket.payload1();

        switch (dataPacket.flag()) {
            case Enum.Packet.Client.Flag.FILE_REQUEST:
                this.file = param.file;
                break;
        }

        this.context = {
            name: file.name,
            size: file.size,
            type: file.type
        };
        if (this.context.size > this.config.maxFileSize) {
            this.listeners.close('File is larger than the maximum allowed size.');
            return;
        }

        this.dataPacket = dataPacket;
        this.dataPacket.param.blobContext = this.context;

        this.openReader();

        this.send(Enum.Pipe.Command.START_TRANSFER, false, this.extension(true));
    }

    FileSender.prototype.openReader = function() {
        this.listeners.log.trace('FileSender', 'openReader');
        var self = this;

        this.seqNo = 0;
        this.previousOffset = 0;
        this.offset = 0;
        this.balance = this.context.size;

        this.fileReader = new FileReader();
        this.fileReader.onload = function(event) {
            var data = new Uint8Array(event.target.result);

            self.send(Enum.Pipe.Command.TRANSFER, false, self.extension(false, true), data);
            self.callback(null, self.result());
        }

        this.fileReader.onerror = function(error) {
            self.error('Read file error:' + error.message);
        };
    }

    FileSender.prototype.closeReader = function() {
        this.listeners.log.trace('FileSender', 'closeReader:' + this.fileReader.readyState);
        if (this.fileReader.readyState === 1) {
            this.fileReader.abort();
        }
    }

    FileSender.prototype.nextChunk = function(id, seqNo) {
        this.listeners.log.trace('FileSender', 'nextChunk');

        if (id !== this.id) {
            this.error('ID mismatch:' + id + ':' + this.id);
            return;
        }

        if (seqNo !== this.seqNo) {
            this.error('Sequence mismatch:' + seqNo + ':' + this.seqNo);
            return;
        }

        if (this.balance > 0) {
            this.chunkSize = Math.min(this.config.chunkSize, this.balance);

            var start = this.offset,
                end = this.offset + this.chunkSize,
                chunk = this.file.slice(start, end);

            this.previousOffset = this.offset;
            this.offset += this.chunkSize;
            this.balance -= this.chunkSize;

            this.fileReader.readAsArrayBuffer(chunk);

        } else {
            this.previousOffset = this.offset;
            this.offset += this.chunkSize;
            this.balance -= this.chunkSize;

            this.send(Enum.Pipe.Command.END_TRANSFER, false, this.extension());
        }
    }

    FileSender.prototype.error = function(error) {
        this.send(Enum.Pipe.Command.TRANSFER_ERROR, false, this.extension());
        if (this.callback) this.callback(error, this.result(error));

        this.stopTimeout();
        this.closeReader();
        this.listeners.error(this.id, error);
    }

    FileSender.prototype.end = function() {
        this.stopTimeout();
        this.closeReader();

        this.listeners.log.trace('FileSender', 'end:' + this.id);
        this.listeners.close(this.id);

        this.callback(null, this.result());
    }

    FileSender.prototype.abort = function() {
        this.listeners.log.trace('FileSender', 'abort');

        this.stopTimeout();
        this.closeReader();

        this.callback('Operation aborted', this.result(true));
    }

    FileSender.prototype.percentComplete = function() {
        return ((this.previousOffset / this.context.size) * 100).toFixed(1);
    }

    FileSender.prototype.extension = function(includeContext, includeChunkSize) {
        var value = {
            id: this.id,
        };

        if (includeContext) value.context = this.context;
        if (includeChunkSize) value.chunkSize = this.chunkSize;

        return value;
    }

    FileSender.prototype.result = function(error) {
        var result = {
            id: this.id,
            percentComplete: this.percentComplete()
        }

        if (error || (this.balance === 0)) {
            result.context = this.context;
        }

        return result;
    }

    FileSender.prototype.send = function(command, acknowledge, extension, payload) {
        var flag = (acknowledge) ? Enum.Packet.IO.Flag.ACKNOWLEDGE : Enum.Packet.IO.Flag.NONE;

        this.listeners.send(this.packetHelper.writePipe(Enum.Pipe.EVP_VER, command, flag, ++this.seqNo, extension, payload));

        switch (command) {
            case Enum.Pipe.Command.START_TRANSFER:
            case Enum.Pipe.Command.TRANSFER:
            case Enum.Pipe.Command.END_TRANSFER:
                this.stopTimeout();
                this.startTimeout();
                break;

            case Enum.Pipe.Command.TRANSFER_ERROR:
                this.stopTimeout();
                break;
        }
    }

    FileSender.prototype.stopTimeout = function() {
        this.listeners.log.trace('FileSender', 'stopTimeout');
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
            this.timeoutTimer = undefined;
        }
    }

    FileSender.prototype.startTimeout = function() {
        this.listeners.log.trace('FileSender', 'startTimeout');
        if (!this.timeoutTimer) {
            var self = this;

            this.timeoutTimer = setTimeout(function() {
                self.timeoutTimer = undefined;
                self.error('Timeout at offset:' + self.previousOffset);
            }, this.config.timeoutSecs * 1000);
        }
    }
},{"../enum":12}],21:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    var events = require('events'),
        Enum = require('../enum');

    module.exports = Pipe;

    function Pipe(config, Components) {
        this.config = config;
        this.Components = Components;
    }

    Pipe.prototype.start = function(packetHelper, listeners) {
        this.listeners = listeners;
        this.keepAlive = false;
        this.state = Enum.Pipe.State.WAIT_READY;
        this.sequenceNo = 0;

        this.delegate = new events.EventEmitter();
        this.delegate.setMaxListeners(this.config.maxListeners);

        this.packetHelper = packetHelper;

        this.pipeListeners = {
            log: this.listeners.log,
            send: this.listeners.send
        };

        this.blobHandlers = new this.Components.BlobHandlers(this.config.BlobHandler, this.packetHelper);
    }

    Pipe.prototype.open = function(keepAlive) {
        this.keepAlive = keepAlive;
        this.listeners.send(this.packetHelper.writePipe(Enum.Pipe.EVP_VER, Enum.Pipe.Command.OPEN, Enum.Packet.IO.Flag.NONE, ++this.sequenceNo));
    }

    Pipe.prototype.openAcknowledge = function(id) {
        this.listeners.log.trace('Pipe', 'openAcknowledge');

        this.startHeartBeat();
        this.id = id;
        this.state = Enum.Pipe.State.READY;

        this.delegate.emit('open', this.id);
    }

    Pipe.prototype.ready = function() {
        return (this.state === Enum.Pipe.State.READY);
    }

    Pipe.prototype.close = function() {
        this.listeners.log.trace('Pipe', 'close');

        this.listeners.close();
    }

    Pipe.prototype.onClose = function() {
        this.listeners.log.trace('Pipe', 'onClose');

        if (this.state !== Enum.Pipe.State.WAIT_READY) {
            this.stopHeartBeat();
            this.state = Enum.Pipe.State.WAIT_READY;
            this.delegate.emit('close', this.id);
        }
    }

    Pipe.prototype.stopHeartBeat = function() {
        if (this.keepAlive) {
            this.listeners.log.trace('Pipe', 'stopHeartBeat');

            if (this.heartBeatTimer) {
                clearInterval(this.heartBeatTimer);
                this.heartBeatTimer = null;
            }

            this.stopPingTimeout();
        }
    }

    Pipe.prototype.startHeartBeat = function() {
        if (this.keepAlive) {
            this.listeners.log.trace('Pipe', 'startHeartBeat');

            if (!this.heartBeatTimer) {
                var self = this;

                if (this.heartBeatTimer) {
                    clearInterval(this.heartBeatTimer);
                }

                this.heartBeatTimer = setInterval(function() {
                    self.ping();
                }, this.config.HeartBeat.intervalSecs * 1000);

                this.startPingTimeout();
            }
        }
    }

    Pipe.prototype.ping = function() {
        this.listeners.log.trace('Pipe', 'ping');
        this.listeners.send(this.packetHelper.writePipe(Enum.Pipe.EVP_VER, Enum.Pipe.Command.PING, Enum.Packet.IO.Flag.NONE, ++this.sequenceNo));
    };

    Pipe.prototype.stopPingTimeout = function() {
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = undefined;
        }
    }

    Pipe.prototype.startPingTimeout = function() {
        if (!this.pingTimeout) {
            var self = this;

            this.pingTimeout = setTimeout(function() {
                self.pingTimeout = undefined;
                self.close();
            }, this.config.HeartBeat.timeoutSecs * 1000);
        }
    }

    Pipe.prototype.error = function(error) {
        // this.listeners.log.error('Pipe', error);
        console.log('Pipe', error);
    }

    Pipe.prototype.on = function(event, callback) {
        this.delegate.on(event, callback);
    };

    Pipe.prototype.sendRequest = function(clientRequest, percentCallback) {
        if (this.ready()) {
            switch (clientRequest.flag) {
                case Enum.Packet.Client.Flag.REQUEST:
                    this.listeners.send(
                        this.packetHelper.writePipe(
                            Enum.Pipe.EVP_VER,
                            Enum.Pipe.Command.REQUEST,
                            Enum.Packet.IO.Flag.NONE,
                            ++this.sequenceNo,
                            clientRequest.toWebSocketBuffer()
                        )
                    );
                    break;

                case Enum.Packet.Client.Flag.BLOB_REQUEST:
                    this.blobHandlers.startSender(clientRequest.toDataPacket(), this.pipeListeners, percentCallback);
                    break;

                case Enum.Packet.Client.Flag.FILE_REQUEST:
                    this.blobHandlers.startSender(clientRequest.toDataPacket(), this.listeners, percentCallback);
                    break;

                default:
                    this.listeners.log.error('Pipe', 'Client request flag is invalid:' + flag);
                    break;
            }

        } else {
            this.listeners.log.error('Pipe', 'Client is not ready.');
        }
    };

    Pipe.prototype.getFile = function(event, token, callback) {
        var payload = {
            id: this.blobHandlers.newReceiver(callback),
            token: token
        };
        this.emit(event, payload);
    };

    Pipe.prototype.receive = function(data) {
        var self = this,
            packet = this.packetHelper.readPipe(data);

        switch (packet.command) {
            case Enum.Pipe.Command.OPEN:
                if (packet.flag & Enum.Packet.IO.Flag.ACKNOWLEDGE) {
                    this.openAcknowledge(packet.extension);
                }
                break;

            case Enum.Pipe.Command.PING:
                if (packet.flag & Enum.Packet.IO.Flag.ACKNOWLEDGE) {
                    this.listeners.log.trace('Pipe', 'pong');
                    this.stopPingTimeout();
                    this.startPingTimeout();
                }
                break;

            case Enum.Pipe.Command.CLOSE:
                this.listeners.close();
                break;

            case Enum.Pipe.Command.RESPONSE:
                var clientResponse = new this.Components.ClientResponse.fromWebSocketBuffer(packet.extension);
                this.listeners.receiveResponse(clientResponse);
                break;

            case Enum.Pipe.Command.START_TRANSFER:
                // this.listeners.log.trace('Pipe', 'Enum.Pipe.Command.START_TRANSFER');
                if (packet.flag & Enum.Packet.IO.Flag.ACKNOWLEDGE) {
                    this.blobHandlers.sendNextChunk(packet.extension.id, packet.seqNo);

                } else {
                    var dataPacket = this.Components.DataPacket.fromWebSocketBuffer(packet.payload);
                    dataPacket.addHop(Enum.Packet.Hop.BLOB);

                    this.blobHandlers.startReceiver(packet.extension.id, dataPacket, this.pipeListeners);
                }
                break;

            case Enum.Pipe.Command.TRANSFER:
                // this.listeners.log.trace('Pipe', 'Enum.Pipe.Command.TRANSFER');
                if (packet.flag & Enum.Packet.IO.Flag.ACKNOWLEDGE) {
                    this.blobHandlers.sendNextChunk(packet.extension.id, packet.seqNo);

                } else {
                    this.blobHandlers.receiveNextChunk(packet.extension.id, packet.seqNo, packet.extension.chunkSize, packet.payload);
                }
                break;

            case Enum.Pipe.Command.TRANSFER_ERROR:
                // this.listeners.log.trace('Pipe', 'Enum.Pipe.Command.TRANSFER_ERROR');
                this.blobHandlers.abort(packet.extension.id);
                break;

            case Enum.Pipe.Command.END_TRANSFER:
                // this.listeners.log.trace('Pipe', 'Enum.Pipe.Command.END_TRANSFER');
                if (packet.flag & Enum.Packet.IO.Flag.ACKNOWLEDGE) {
                    this.blobHandlers.endSender(packet.extension.id);

                } else {
                    this.blobHandlers.endReceiver(
                        packet.extension.id,
                        function(result) {
                            var clientResponse = self.Components.ClientResponse.fromDataPacket(result.dataPacket);
                            self.listeners.receiveResponse(clientResponse);
                        }
                    );
                }
                break;

            default:
                this.listeners.log.trace('Pipe', 'Invalid command:', packet.command);
                break;
        }
    }
},{"../enum":12,"events":35}],22:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    var nacl = require('tweetnacl'),
        Enum = require('../enum').CurveZMQ,
        BufferView = require('../data/buffer-view');

    module.exports = CurveZMQ;

    function CurveZMQ(config, metaData) {
        this.config = config;
        this.metaData = metaData;

        this.serverPublicKeyPermanent = nacl.util.decodeBase64(this.config.serverPublicKey);
        this.publicKeyPermanent = nacl.util.decodeBase64(this.config.publicKey);
        this.secretKeyPermanent = nacl.util.decodeBase64(this.config.secretKey);

        var keys = nacl.box.keyPair();
        this.publicKeyTemporary = keys.publicKey;
        this.secretKeyTemporary = keys.secretKey;

        this.messageBufferView = new BufferView(new Uint8Array(this.config.bufferSize));
    }

    CurveZMQ.prototype.start = function(listeners, packetHelper) {
        this.packetHelper = packetHelper;
        this.listeners = listeners;
        this.keepAlive = false;
        this.state = Enum.State.SEND_HELLO;
    }

    CurveZMQ.prototype.open = function(keepAlive) {
        this.listeners.log.trace('CurveZMQ', 'Open');

        this.keepAlive = keepAlive;
        this.state = Enum.State.WAIT_WELCOME;

        var hello = this.encode_hello();
        if (hello) {
            this.short_nonce = hello.s_nonce;
            this.listeners.send(hello.pkt);
        }
    }

    CurveZMQ.prototype.onClose = function() {
        this.listeners.log.trace('CurveZMQ', 'onClose');

        if (this.state !== Enum.State.SEND_HELLO) {
            this.state = Enum.State.SEND_HELLO;
            this.listeners.onClose();
        }
    }

    CurveZMQ.prototype.send = function(data) {
        increment_nonce(this.short_nonce);
        var msg = this.encode_message(data, this.messageBufferView, this.short_nonce);
        this.listeners.send(msg.pkt);
    }

    CurveZMQ.prototype.receive = function(uint8Array) {
        var bufferView = new BufferView(uint8Array);

        switch (this.state) {
            case Enum.State.WAIT_WELCOME:
                var welcome = this.decode_welcome(bufferView);
                if (!welcome.err) {
                    this.listeners.log.trace('CurveZMQ', 'Received welcome, sending initiate');
                    this.state = Enum.State.WAIT_READY;

                    this.serverPublicKeyTemporary = welcome.sk;
                    increment_nonce(this.short_nonce);

                    var metaData = this.packetHelper.writeMetaData(this.metaData.idToken, this.metaData.sessionToken);

                    var pkt = this.encode_initiate(welcome.c, this.short_nonce, metaData);
                    this.listeners.send(pkt);

                } else {
                    this.listeners.log.error('CurveZMQ', welcome.err);
                    this.listeners.close();
                }
                break;

            case Enum.State.WAIT_READY:
                var ready = this.decode_ready(bufferView);
                if (!ready.err) {
                    this.listeners.log.trace('CurveZMQ', 'Ready');
                    this.state = Enum.State.READY;
                    this.srv_short_nonce = ready.s_nonce;
                    this.listeners.open(this.keepAlive);

                } else {
                    this.listeners.log.error('CurveZMQ', ready.err);
                    this.listeners.close();
                }
                break;

            case Enum.State.READY:
                increment_nonce(this.srv_short_nonce);
                var message = this.decode_message(bufferView, this.srv_short_nonce);
                if (!message.err)
                    this.listeners.forward(message.data);

                else {
                    this.listeners.log.error('CurveZMQ', message.err);
                    this.listeners.close();
                }
                break;

            default:
                this.listeners.log.error('CurveZMQ', 'Invalid adaptor state:' + this.state);
                this.listeners.close();
                break;
        }
    }

    CurveZMQ.prototype.encode_hello = function() {
        try {
            var pkt_hello = new BufferView(new Uint8Array(215 + 16));
            pkt_hello.fill(0);
            pkt_hello.rewind();
            pkt_hello.writeUTF8('HELLO');
            pkt_hello.writeUInt8(1);
            pkt_hello.writeUInt8(0);
            pkt_hello.fill(0, pkt_hello.offset, pkt_hello.offset + 72);
            pkt_hello.skip(72);
            pkt_hello.append(this.publicKeyTemporary);

            var nonce = gen_nonce('CurveZMQHELLO---', 8);
            var zeros = new Uint8Array(64);
            var box = nacl.box(zeros, nonce, this.serverPublicKeyPermanent, this.secretKeyTemporary);

            pkt_hello.append(nonce);
            pkt_hello.append(new Uint8Array(box.buffer));

            return {
                pkt: pkt_hello.buffer,
                s_nonce: nonce.subarray(16)
            };

        } catch (error) {
            this.listeners.log.error('CurveZMQ', error.message, error.code);
        }
    }

    CurveZMQ.prototype.decode_welcome = function(bufferView) {
        try {
            if (bufferView.length() !== (183 + 32))
                return {
                    err: 'wrong length'
                };

            var cmd = bufferView.readUTF8(7);
            if (cmd !== 'WELCOME')
                return {
                    err: 'wrong cmd'
                };

            var welcome_nonce = bufferView.slice(bufferView.offset, bufferView.offset + 24);
            bufferView.skip(24);
            var welcome = nacl.box.open(bufferView.slice(bufferView.offset + 16), welcome_nonce, this.serverPublicKeyPermanent, this.secretKeyTemporary);
            if (!welcome)
                return {
                    err: 'authentication fails'
                };
            var serverPublicKeyTemporary = welcome.subarray(0, 32);

            var cookie = welcome.subarray(32);
            return {
                c: cookie,
                sk: serverPublicKeyTemporary
            };

        } catch (error) {
            this.listeners.log.error('CurveZMQ', error.message, error.code);
        }
    }

    CurveZMQ.prototype.decode_ready = function(bufferView) {
        try {
            if (bufferView.length() < 46)
                return {
                    err: 'wrong length'
                };

            var cmd = bufferView.readUTF8(5);
            if (cmd !== 'READY')
                return {
                    err: 'wrong cmd'
                };

            var ready_nonce = bufferView.slice(bufferView.offset, bufferView.offset + 24);
            bufferView.skip(24);

            var ready = nacl.box.open(bufferView.slice(bufferView.offset + 16), ready_nonce, this.serverPublicKeyTemporary, this.secretKeyTemporary);
            if (!ready)
                return {
                    err: 'authentication fails'
                };
            // no need to check meta data for the time being
            return {
                s_nonce: ready_nonce.subarray(16)
            };

        } catch (error) {
            this.listeners.log.error('CurveZMQ', error.message, error.code);
        }
    }

    CurveZMQ.prototype.encode_initiate = function(cookie, short_nonce, metaData) {
        try {
            var vouch = new BufferView(new Uint8Array(120));
            var vouch_nonce = gen_nonce('VOUCH---', 16);
            vouch.append(vouch_nonce);
            vouch.append(this.publicKeyTemporary);
            vouch.append(this.serverPublicKeyPermanent);
            var vouch_box = nacl.box(vouch.slice(24, 24 + 64), vouch_nonce, this.serverPublicKeyTemporary, this.secretKeyPermanent);
            vouch.append(new Uint8Array(vouch_box.buffer), 24);

            var len = 8 + cookie.byteLength + 24 + 32 + vouch.length() + 32 + metaData.length;
            var pkt_initiate = new BufferView(new Uint8Array(len));
            pkt_initiate.writeUTF8('INITIATE');
            pkt_initiate.append(cookie);
            var mark = pkt_initiate.offset;
            pkt_initiate.writeUTF8('CurveZMQINITIATE');
            pkt_initiate.append(short_nonce);
            var initiate_nonce = pkt_initiate.slice(mark, pkt_initiate.offset);
            mark = pkt_initiate.offset;
            pkt_initiate.append(this.publicKeyPermanent);
            pkt_initiate.append(vouch.buffer);
            pkt_initiate.append(metaData);

            var init_box = nacl.box(pkt_initiate.slice(mark, pkt_initiate.offset), initiate_nonce, this.serverPublicKeyTemporary, this.secretKeyTemporary);
            pkt_initiate.append(new Uint8Array(init_box.buffer), mark);

            return pkt_initiate.buffer;

        } catch (error) {
            this.listeners.log.error('CurveZMQ', error.message, error.code);
        }
    }

    CurveZMQ.prototype.encode_message = function(payload, bufferView, short_nonce) {
        try {
            bufferView.rewind();
            bufferView.writeUTF8('MESSAGE');

            var mark = bufferView.offset;
            bufferView.writeUTF8('CurveZMQMESSAGE-');
            bufferView.append(short_nonce);
            var message_nonce = bufferView.slice(mark, bufferView.offset);

            mark = bufferView.offset;
            bufferView.append(payload);

            var box = nacl.box(bufferView.slice(mark, bufferView.offset), message_nonce, this.serverPublicKeyTemporary, this.secretKeyTemporary);
            var b = new Uint8Array(box.buffer);
            bufferView.append(b, mark);
            bufferView.set(mark + b.byteLength);
            return {
                pkt: bufferView.buffer.subarray(0, bufferView.offset)
            };

        } catch (error) {
            this.listeners.log.error('CurveZMQ', error.message, error.code);
        }
    }

    CurveZMQ.prototype.decode_message = function(bufferView, short_nonce) {
        try {
            if (bufferView.length() < 49)
                return {
                    err: 'wrong length'
                };

            var cmd = bufferView.readUTF8(7);
            if (cmd !== 'MESSAGE')
                return {
                    err: 'wrong cmd'
                };

            var message_nonce = bufferView.slice(bufferView.offset, bufferView.offset + 24);
            bufferView.skip(24);

            var expected_nonce = new BufferView(new Uint8Array(24));
            expected_nonce.writeUTF8('CurveZMQMESSAGE-');
            expected_nonce.append(short_nonce);

            var err = comp(expected_nonce.buffer, message_nonce);
            if (err)
                return {
                    err: 'wrong nonce'
                };
            var message = nacl.box.open(bufferView.slice(bufferView.offset + 16), message_nonce, this.serverPublicKeyTemporary, this.secretKeyTemporary);
            if (!message)
                return {
                    err: 'authentication fails'
                };

            return {
                data: message
            };

        } catch (error) {
            this.listeners.log.error('CurveZMQ', error.message, error.code);
        }
    }

    function increment_nonce(n) {
        var hi = (n[0] << 24 & 0xffffffff) | (n[1] << 16 & 0xffffff) | (n[2] << 8 & 0xffff) | (n[3] & 0xff);
        var lo = (n[4] << 24 & 0xffffffff) | (n[5] << 16 & 0xffffff) | (n[6] << 8 & 0xffff) | (n[7] & 0xff);
        lo += 1;
        if (lo >= Enum.MAX_INT) {
            lo -= Enum.MAX_INT;
            hi += 1;
        }
        n[0] = (hi >>> 24 & 0xff);
        n[1] = (hi >>> 16 & 0xff);
        n[2] = (hi >>> 8 & 0xff);
        n[3] = (hi & 0xff);
        n[4] = (lo >>> 24 & 0xff);
        n[5] = (lo >>> 16 & 0xff);
        n[6] = (lo >>> 8 & 0xff);
        n[7] = (lo & 0xff);
    };

    function comp(a, b) {
        if (a.byteLength == b.byteLength) {
            for (var i = 0; i < a.byteLength; i++)
                if (a[i] != b[i])
                    return i + ':' + a[i] + '<->' + b[i];
        } else
            return 'len<>';
    }

    function gen_nonce(prefix, len) {
        var b = new Uint8Array(24);
        var buf = new BufferView(b);
        var start = buf.offset;
        buf.writeUTF8(prefix);
        var rnd = nacl.randomBytes(len);
        buf.append(rnd);
        return b;
    }
},{"../data/buffer-view":4,"../enum":12,"tweetnacl":29}],23:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    var Enum = require('../enum');

    module.exports.newAdaptor = function(config, metaData) {
        var adaptor = undefined;

        switch (config.protocol) {
            case Enum.DataProtocol.SIMPLE:
                var Simple = require('./simple');
                adaptor = new Simple();
                break;

            case Enum.DataProtocol.CURVE_ZMQ:
                var CurveZMQ = require('./curve-zmq');
                adaptor = new CurveZMQ(config.CurveZMQ, metaData);
                break;

            default:
                log.error('Invalid protocol:%s', config.protocol);
                break;
        }

        return adaptor;
    }
},{"../enum":12,"./curve-zmq":22,"./simple":24}],24:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    module.exports = Default;

    function Default() {}

    Default.prototype.start = function(listeners) {
        this.listeners = listeners;
    }

    Default.prototype.open = function(keepAlive) {
        this.listeners.open(keepAlive);
    }

    Default.prototype.close = function() {
        this.listeners.close();
    }

    Default.prototype.onClose = function() {
        this.listeners.onClose();
    }

    Default.prototype.receive = function(data) {
        this.listeners.forward(data);
    }

    Default.prototype.send = function(data) {
        this.listeners.send(data);
    }
},{}],25:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    var Enum = {
        Socket: require('../enum').Socket.HTTPLongPoll,
        KEEP_ALIVE: require('../enum').Socket.KEEP_ALIVE,
        Packet: require('../enum').Packet
    };

    module.exports = Socket;

    function Socket(packetHelper) {
        this.packetHelper = packetHelper;
        this.socketId = undefined;
        this.queue = [];
        this.connected = false;
        this.opened = false;
        this.pingCount = 0;
    }

    Socket.prototype.start = function(listeners) {
        this.listeners = listeners;
        this.newRequest();
    }

    Socket.prototype.ip = function() {
        if (this.request) {
            return this.request.ip;
        }
    }

    Socket.prototype.newRequest = function() {
        // console.log('newRequest:');
        var self = this;

        this.request = new XMLHttpRequest();
        this.request.responseType = "arraybuffer";

        this.request.addEventListener('error', function(error) {
            // self.error(error);
            self.close();
        });

        this.request.onreadystatechange = function() {
            // console.log('State:', self.request.readyState)
            self.opened = false;
            self.awaitingResponse = false
            switch (self.request.readyState) {
                case Enum.Socket.State.OPENED:
                    self.opened = true;
                    setTimeout(self.sendPacket.bind(self), 1);

                case Enum.Socket.State.DONE:
                    switch (self.request.status) {
                        case Enum.Socket.Status.SUCCESSFULL:
                            self.connected = true;
                            switch (self.request.responseType) {
                                case 'arraybuffer':
                                    self.receive(self.request.response.slice(0));
                                    setTimeout(self.openRequest.bind(self), 1);
                                    break;

                                default:
                                    self.error('Invalid response type:' + self.request.responseType)
                            }
                            break;

                        default:
                            if (self.request.status) {
                                self.error('Device status:' + self.request.status);
                            }
                            break;
                    }

                case Enum.Socket.State.UNSENT:
                case Enum.Socket.State.LOADING:
                case Enum.Socket.State.HEADERS_RECEIVED:
                    break;
            }
        }
    }

    Socket.prototype.error = function(error) {
        console.log('Error:', error)
        // this.listeners.log.error('Socket', error);
    }

    Socket.prototype.open = function(url) {
        console.log('open:', url);
        this.url = url;
        this.queue = [];
        this.openRequest(true);
        this.queuePacket(Enum.Socket.Command.CONNECT, 0);
    }

    Socket.prototype.openRequest = function(force) {
        if (force || !this.opened) {
            // console.log('openRequest:', this.request.readyState);
            this.awaitingResponse = false;

            this.request.open('POST', this.url);
            this.request.setRequestHeader('Content-Type', 'application/octet-stream');
        }
    }

    Socket.prototype.ping = function(data) {
        // console.log('ping:', data);
        this.send(data);
    }

    Socket.prototype.send = function(data) {
        // console.log('send:', data);
        if (this.awaitingResponse) {
            this.openRequest(true);
        }
        this.queuePacket(Enum.Socket.Command.MESSAGE, data);
    }

    Socket.prototype.queuePacket = function(command, data) {
        // console.log('queuePacket:', command, ':', data);
        this.queue.push(this.packetHelper.writeHttpLongPoll(command, 0, this.socketId, data));
        this.sendPacket();
    }

    Socket.prototype.sendPacket = function() {
        // console.log('sendPacket:', this.queue.length, ' opened:', this.opened, ' awaitingResponse:', this.awaitingResponse);
        if (this.opened) {
            var packet = this.queue.shift();
            if (!packet) {
                packet = this.packetHelper.writeHttpLongPoll(Enum.Socket.Command.OPEN, 0, this.socketId);
                this.awaitingResponse = true;
            }
            this.request.send(packet);

        } else {
            this.startResponseTimeout();
        }
    }

    Socket.prototype.receive = function(response) {
        this.stopResponseTimeout();

        var uint8Array = new Uint8Array(response);
        var packet = this.packetHelper.readHttpLongPoll(uint8Array);
        // console.log('receive:', packet.command, ':', packet.id)

        switch (packet.command) {
            case Enum.Socket.Command.CONNECT:
                this.socketId = packet.id;
                // this.listeners.log.trace('Socket', 'Opened: ' + this.url + ':' + this.socketId);
                this.listeners.open(Enum.KEEP_ALIVE);
                break;

            case Enum.Socket.Command.MESSAGE:
                this.listeners.receive(packet.message);
                break;

            case Enum.Socket.Command.CLOSE:
                this.close();
                break;

            default:
                this.error('Invalid command:' + packet.command);
        }
    }

    Socket.prototype.close = function() {
        if (this.connected) {
            this.connected = false;

            if (this.request) {
                this.request.abort();
            }
            this.listeners.onClose();
            this.listeners.log.trace('Socket', 'Closed');
        }
    }

// Socket.prototype.toBuffer = function(arrayBuffer) {
// 	return new Uint8Array(arrayBuffer);
// }

    Socket.prototype.stopResponseTimeout = function() {
        if (this.responseTimeout) {
            // console.log('>>> stopResponseTimeout')
            clearTimeout(this.responseTimeout);
            this.responseTimeout = null;
        }
    }

    Socket.prototype.startResponseTimeout = function() {
        if (!this.responseTimeout) {
            // console.log('>>> startResponseTimeout')
            var self = this;

            this.responseTimeout = setTimeout(function() {
                // console.log('>>> on ResponseTimeout')
                self.responseTimeout = null;
                self.openRequest(true);
            }, Enum.Socket.responseTimeoutMillisecs);
        }
    }
},{"../enum":12}],26:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    var Enum = require('../enum');

    module.exports = Socket;

    function Socket(config, webAPI) {
        this.config = config;
        this.webAPI = webAPI;
        this.initUrl();
    }

    Socket.prototype.start = function(packetHelper, listeners) {
        this.packetHelper = packetHelper;
        this.listeners = listeners;

        var innerListeners = {
            open: this.open.bind(this),
            onClose: this.onClose.bind(this),
            receive: this.listeners.receive,
            log: this.listeners.log
        };

        switch (this.config.device) {
            case Enum.Socket.Device.HTTP_LONG_POLL:
                var HTTPLongPoll = require('./http-long-poll-socket');
                this.innerSocket = new HTTPLongPoll(this.packetHelper);
                break;

            case Enum.Socket.Device.WS:
            case Enum.Socket.Device.WEB_SOCKET:
            default:
                var WebSocket = require('./web-socket');
                this.innerSocket = new WebSocket();
                break;
        }

        this.innerSocket.start(innerListeners);
        this.startConnectTimer();
    }

    Socket.prototype.startConnectTimer = function() {
        this.listeners.log.trace('Socket', 'startConnectTimer - ' + (this.connectTimer === undefined));
        var self = this;

        this.stopReconnectTimeout();

        if (!this.connectTimer) {
            this.connectAttempt = 1;
            self.connect();

            this.connectTimer = setInterval(function() {
                self.connect();
            }, this.config.connectTimeoutSecs * 1000);
        }
    }

    Socket.prototype.stopConnectTimer = function() {
        this.listeners.log.trace('Socket', 'stopConnectTimer - ' + (this.connectTimer !== undefined));
        if (this.connectTimer) {
            clearInterval(this.connectTimer);
            this.connectTimer = undefined;
        }
    }

    Socket.prototype.stopReconnectTimeout = function() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = undefined;
        }
    }

    Socket.prototype.connect = function() {
        if (this.connectAttempt <= this.config.maxConnectAttempts) {
            this.listeners.log.trace('Socket', 'Connect attempt ' + this.connectAttempt++);
            this.innerSocket.open(this.url);

        } else {
            this.listeners.log.error('Socket', 'Exceeded maximum connect attempts - ' + this.config.maxConnectAttempts);
            this.stopConnectTimer();
        }
    }

    Socket.prototype.open = function(keepAlive) {
        this.listeners.log.trace('Socket', 'open');

        this.stopConnectTimer();

        keepAlive = keepAlive || false
        this.listeners.open(keepAlive);
    }

    Socket.prototype.send = function(data) {
        this.innerSocket.send(data);
    }

    Socket.prototype.close = function() {
        this.innerSocket.close();
    }

    Socket.prototype.onClose = function() {
        this.listeners.log.trace('Socket', 'onClose');
        this.listeners.onClose();

        if (!this.reconnectTimeout) {
            var self = this;
            this.reconnectTimeout = setTimeout(function() {
                self.reconnectTimeout = undefined;
                self.startConnectTimer();
            }, this.config.reconnectWaitSecs * 1000);
        }
    }

    Socket.prototype.initUrl = function() {
        var protocol = undefined,
            isWebSocket = true;

        switch (this.config.device) {
            case Enum.Socket.Device.HTTP_LONG_POLL:
                isWebSocket = false;
                break;
        }

        switch (this.config.protocol) {
            case Enum.ServerProtocol.HTTPS:
                protocol = (isWebSocket) ? 'wss' : 'https';
                break;

            case Enum.ServerProtocol.HTTP:
            default:
                protocol = (isWebSocket) ? 'ws' : 'http';
                break;
        }

        this.url = protocol + '://' + this.config.host + ':' + this.config.port + Enum.Pipe.EVP_PATH;
    }
},{"../enum":12,"./http-long-poll-socket":25,"./web-socket":27}],27:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    var Enum = require('../enum').Socket;

    Enum.Inner = {
        State: {
            CONNECTING: 0,
            OPEN: 1,
            CLOSING: 2,
            CLOSED: 3
        }
    }

    module.exports = Socket;

    function Socket() {}

    Socket.prototype.start = function(listeners) {
        this.listeners = listeners;
    }

// Socket.prototype.connected = function() {
// 	return (this.innerSocket.readyState === Enum.Inner.State.OPEN);
// }

    Socket.prototype.open = function(url) {
        var self = this;

        this.innerSocket = new WebSocket(url);
        this.innerSocket.binaryType = 'arraybuffer';

        this.innerSocket.addEventListener('open', function(event) {
            self.listeners.open(Enum.KEEP_ALIVE);
            self.listeners.log.trace('Socket', 'Opened: ' + url);

            self.innerSocket.addEventListener('close', function(event) {
                self.listeners.onClose();
                self.listeners.log.trace('Socket', 'Closed: (code ' + event.code + ') ' + event);
            });

            self.innerSocket.addEventListener('message', function(event) {
                var uint8Array = new Uint8Array(event.data);
                self.listeners.receive(uint8Array);
            });

            self.innerSocket.addEventListener('error', function(event) {
                self.listeners.log.error('Socket', event.data);
            });
        });
    }

    Socket.prototype.ping = function(uint8Array) {
        // console.log('ping:', data);
        this.send(uint8Array);
    }

    Socket.prototype.send = function(uint8Array) {
        try {
            this.innerSocket.send(uint8Array, {
                binary: true
            });

        } catch (error) {
            this.listeners.log.error('Socket', error.message);
        }
    }

    Socket.prototype.close = function() {
        switch (this.innerSocket.readyState) {
            case Enum.Inner.State.CONNECTING:
            case Enum.Inner.State.OPEN:
                this.innerSocket.close();
                break;
        }
    }

    Socket.prototype.reason = function(code) {
        var reason;

        // See http://tools.ietf.org/html/rfc6455#section-7.4.1
        if (code == 1000)
            reason = "Normal closure, meaning that the purpose for which the connection was established has been fulfilled.";
        else if (code == 1001)
            reason = "An endpoint is \"going away\", such as a server going down or a browser having navigated away from a page.";
        else if (code == 1002)
            reason = "An endpoint is terminating the connection due to a protocol error";
        else if (code == 1003)
            reason = "An endpoint is terminating the connection because it has received a type of data it cannot accept (e.g., an endpoint that understands only text data MAY send this if it receives a binary message).";
        else if (code == 1004)
            reason = "Reserved. The specific meaning might be defined in the future.";
        else if (code == 1005)
            reason = "No status code was actually present.";
        else if (code == 1006)
            reason = "The connection was closed abnormally, e.g., without sending or receiving a Close control frame";
        else if (code == 1007)
            reason = "An endpoint is terminating the connection because it has received data within a message that was not consistent with the type of the message (e.g., non-UTF-8 [http://tools.ietf.org/html/rfc3629] data within a text message).";
        else if (code == 1008)
            reason = "An endpoint is terminating the connection because it has received a message that \"violates its policy\". This reason is given either if there is no other sutible reason, or if there is a need to hide specific details about the policy.";
        else if (code == 1009)
            reason = "An endpoint is terminating the connection because it has received a message that is too big for it to process.";
        else if (code == 1010) // Note that this status code is not used by the server, because it can fail the WebSocket handshake instead.
            reason = "An endpoint (client) is terminating the connection because it has expected the server to negotiate one or more extension, but the server didn't return them in the response message of the WebSocket handshake. <br /> Specifically, the extensions that are needed are: " + event.reason;
        else if (code == 1011)
            reason = "A server is terminating the connection because it encountered an unexpected condition that prevented it from fulfilling the request.";
        else if (code == 1015)
            reason = "The connection was closed due to a failure to perform a TLS handshake (e.g., the server certificate can't be verified).";
        else
            reason = "Unknown reason";

        return reason;
    }
},{"../enum":12}],28:[function(require,module,exports){
    /*
     * @copyright unseen, ehf
     */

    'option strict';

    module.exports = {
        Mode: {
            DEV: 'DEV',
            PROD: 'PROD'
        },

        Status: {
            SUCCESS: 0,
            ERROR: 1
        },

        ServerProtocol: {
            HTTP: 'HTTP',
            HTTPS: 'HTTPS'
        },

        DataProtocol: {
            SIMPLE: 'SIMPLE',
            CURVE_ZMQ: 'CURVE_ZMQ'
        },

        CurveZMQ: {
            State: {
                SEND_HELLO: 'SEND_HELLO',
                WAIT_WELCOME: 'WAIT_WELCOME',
                READY: 'READY'
            },

            MAX_INT: Math.pow(2, 32)
        },

        Socket: {
            KEEP_ALIVE: true,

            HTTPLongPoll: {
                Command: {
                    CONNECT: 1,
                    OPEN: 2,
                    MESSAGE: 3,
                    CLOSE: 4
                },

                State: {
                    UNSENT: 0,
                    OPENED: 1,
                    HEADERS_RECEIVED: 2,
                    LOADING: 3,
                    DONE: 4
                },

                Status: {
                    SUCCESSFULL: 200
                },

                responseTimeoutMillisecs: 500
            }
        },

        Pipe: {
            EVP_VER: 1,
            EVP_PATH: '/_evp',

            MAX_INT: Math.pow(2, 32),

            Command: {
                OPEN: 1,
                PING: 2,
                CLOSE: 3,
                EVENT: 4,
                REQUEST: 5,
                RESPONSE: 6,
                START_TRANSFER: 7,
                TRANSFER: 8,
                TRANSFER_ERROR: 9,
                END_TRANSFER: 10
            },

            State: {
                WAIT_READY: 'WAIT_READY',
                READY: 'READY'
            },

            Status: {
                CONNECTION_OPENED: 'CONNECTION_OPENED',
                CONNECTION_CLOSED: 'CONNECTION_CLOSED',
                SESSION_RESTORED: 'SESSION_RESTORED',
                SESSION_UPDATED: 'SESSION_UPDATED',
                SESSION_FAILED: 'SESSION_FAILED'
            },

            ResponseCode: {
                SUCCESS: 1,
                ERROR_SERVER: 501,
                ERROR_UNSUPPORTED: 502,
                ERROR_UNAUTHORISED: 403,
                ERROR_NO_ENTITY: 404,
                ERROR_SOCKET: 498,
                ERROR_TIMEOUT: 499
            }
        },

        Packet: {
            IO: {
                Flag: {
                    NONE: 0,
                    ACKNOWLEDGE: 1
                }
            },

            Client: {
                Flag: {
                    REQUEST: 0,
                    BLOB_REQUEST: 1,
                    FILE_REQUEST: 2,
                    RESPONSE: 3,
                    BLOB_RESPONSE: 4,
                    FILE_RESPONSE: 5,
                    FORWARD_RESPONSE: 6,
                    FORWARD_BLOB_RESPONSE: 7,
                    FORWARD_FILE_RESPONSE: 8,
                    INTERNAL_RESPONSE: 9,
                    QUEUE_EVENT: 10,
                    QUEUE_REQUEST: 11,
                    QUEUE_RESPONSE: 12,
                    REST_REQUEST: 13,
                    REST_RESPONSE: 14
                }
            },

            Hop: {
                BLOB: 'BLOB',
                CLIENT: 'CLIENT',
                SERVER: 'SERVER',
                SERVER_BUFFER: 'SERVER_BUFFER',
                ROUTER_IN: 'ROUTER_IN',
                ROUTER_OUT: 'ROUTER_OUT',
                EXECUTOR: 'EXECUTOR',
                COMMAND: 'COMMAND'
            }
        },

        Blob: {
            ObjectType: {
                UNKNOWN: 0,
                BYTE: 1,
                SHORT_INTEGER: 2,
                INTEGER: 3,
                STRING: 4,
                JSON: 5,
                ARRAY: 6,
                ARRAY_BUFFER: 7,
                UINT8ARRAY: 8,
                BUFFER: 9,
                Key: {
                    0: 'UNKNOWN',
                    1: 'BYTE',
                    2: 'SHORT_INTEGER',
                    3: 'INTEGER',
                    4: 'STRING',
                    5: 'JSON',
                    6: 'ARRAY',
                    7: 'ARRAY_BUFFER',
                    8: 'UINT8ARRAY',
                    9: 'BUFFER'
                }
            },

            Offset: {
                PACKET_LENGTH: 4,
                DATA_OBJECT_METADATA: 5
            }
        }
    };
},{}],29:[function(require,module,exports){
    (function (Buffer){
        (function(nacl) {
            'use strict';

// Ported in 2014 by Dmitry Chestnykh and Devi Mandiri.
// Public domain.
//
// Implementation derived from TweetNaCl version 20140427.
// See for details: http://tweetnacl.cr.yp.to/

            var gf = function(init) {
                var i, r = new Float64Array(16);
                if (init) for (i = 0; i < init.length; i++) r[i] = init[i];
                return r;
            };

//  Pluggable, initialized in high-level API below.
            var randombytes = function(/* x, n */) { throw new Error('no PRNG'); };

            var _0 = new Uint8Array(16);
            var _9 = new Uint8Array(32); _9[0] = 9;

            var gf0 = gf(),
                gf1 = gf([1]),
                _121665 = gf([0xdb41, 1]),
                D = gf([0x78a3, 0x1359, 0x4dca, 0x75eb, 0xd8ab, 0x4141, 0x0a4d, 0x0070, 0xe898, 0x7779, 0x4079, 0x8cc7, 0xfe73, 0x2b6f, 0x6cee, 0x5203]),
                D2 = gf([0xf159, 0x26b2, 0x9b94, 0xebd6, 0xb156, 0x8283, 0x149a, 0x00e0, 0xd130, 0xeef3, 0x80f2, 0x198e, 0xfce7, 0x56df, 0xd9dc, 0x2406]),
                X = gf([0xd51a, 0x8f25, 0x2d60, 0xc956, 0xa7b2, 0x9525, 0xc760, 0x692c, 0xdc5c, 0xfdd6, 0xe231, 0xc0a4, 0x53fe, 0xcd6e, 0x36d3, 0x2169]),
                Y = gf([0x6658, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666]),
                I = gf([0xa0b0, 0x4a0e, 0x1b27, 0xc4ee, 0xe478, 0xad2f, 0x1806, 0x2f43, 0xd7a7, 0x3dfb, 0x0099, 0x2b4d, 0xdf0b, 0x4fc1, 0x2480, 0x2b83]);

            function ts64(x, i, h, l) {
                x[i]   = (h >> 24) & 0xff;
                x[i+1] = (h >> 16) & 0xff;
                x[i+2] = (h >>  8) & 0xff;
                x[i+3] = h & 0xff;
                x[i+4] = (l >> 24)  & 0xff;
                x[i+5] = (l >> 16)  & 0xff;
                x[i+6] = (l >>  8)  & 0xff;
                x[i+7] = l & 0xff;
            }

            function vn(x, xi, y, yi, n) {
                var i,d = 0;
                for (i = 0; i < n; i++) d |= x[xi+i]^y[yi+i];
                return (1 & ((d - 1) >>> 8)) - 1;
            }

            function crypto_verify_16(x, xi, y, yi) {
                return vn(x,xi,y,yi,16);
            }

            function crypto_verify_32(x, xi, y, yi) {
                return vn(x,xi,y,yi,32);
            }

            function core_salsa20(o, p, k, c) {
                var j0  = c[ 0] & 0xff | (c[ 1] & 0xff)<<8 | (c[ 2] & 0xff)<<16 | (c[ 3] & 0xff)<<24,
                    j1  = k[ 0] & 0xff | (k[ 1] & 0xff)<<8 | (k[ 2] & 0xff)<<16 | (k[ 3] & 0xff)<<24,
                    j2  = k[ 4] & 0xff | (k[ 5] & 0xff)<<8 | (k[ 6] & 0xff)<<16 | (k[ 7] & 0xff)<<24,
                    j3  = k[ 8] & 0xff | (k[ 9] & 0xff)<<8 | (k[10] & 0xff)<<16 | (k[11] & 0xff)<<24,
                    j4  = k[12] & 0xff | (k[13] & 0xff)<<8 | (k[14] & 0xff)<<16 | (k[15] & 0xff)<<24,
                    j5  = c[ 4] & 0xff | (c[ 5] & 0xff)<<8 | (c[ 6] & 0xff)<<16 | (c[ 7] & 0xff)<<24,
                    j6  = p[ 0] & 0xff | (p[ 1] & 0xff)<<8 | (p[ 2] & 0xff)<<16 | (p[ 3] & 0xff)<<24,
                    j7  = p[ 4] & 0xff | (p[ 5] & 0xff)<<8 | (p[ 6] & 0xff)<<16 | (p[ 7] & 0xff)<<24,
                    j8  = p[ 8] & 0xff | (p[ 9] & 0xff)<<8 | (p[10] & 0xff)<<16 | (p[11] & 0xff)<<24,
                    j9  = p[12] & 0xff | (p[13] & 0xff)<<8 | (p[14] & 0xff)<<16 | (p[15] & 0xff)<<24,
                    j10 = c[ 8] & 0xff | (c[ 9] & 0xff)<<8 | (c[10] & 0xff)<<16 | (c[11] & 0xff)<<24,
                    j11 = k[16] & 0xff | (k[17] & 0xff)<<8 | (k[18] & 0xff)<<16 | (k[19] & 0xff)<<24,
                    j12 = k[20] & 0xff | (k[21] & 0xff)<<8 | (k[22] & 0xff)<<16 | (k[23] & 0xff)<<24,
                    j13 = k[24] & 0xff | (k[25] & 0xff)<<8 | (k[26] & 0xff)<<16 | (k[27] & 0xff)<<24,
                    j14 = k[28] & 0xff | (k[29] & 0xff)<<8 | (k[30] & 0xff)<<16 | (k[31] & 0xff)<<24,
                    j15 = c[12] & 0xff | (c[13] & 0xff)<<8 | (c[14] & 0xff)<<16 | (c[15] & 0xff)<<24;

                var x0 = j0, x1 = j1, x2 = j2, x3 = j3, x4 = j4, x5 = j5, x6 = j6, x7 = j7,
                    x8 = j8, x9 = j9, x10 = j10, x11 = j11, x12 = j12, x13 = j13, x14 = j14,
                    x15 = j15, u;

                for (var i = 0; i < 20; i += 2) {
                    u = x0 + x12 | 0;
                    x4 ^= u<<7 | u>>>(32-7);
                    u = x4 + x0 | 0;
                    x8 ^= u<<9 | u>>>(32-9);
                    u = x8 + x4 | 0;
                    x12 ^= u<<13 | u>>>(32-13);
                    u = x12 + x8 | 0;
                    x0 ^= u<<18 | u>>>(32-18);

                    u = x5 + x1 | 0;
                    x9 ^= u<<7 | u>>>(32-7);
                    u = x9 + x5 | 0;
                    x13 ^= u<<9 | u>>>(32-9);
                    u = x13 + x9 | 0;
                    x1 ^= u<<13 | u>>>(32-13);
                    u = x1 + x13 | 0;
                    x5 ^= u<<18 | u>>>(32-18);

                    u = x10 + x6 | 0;
                    x14 ^= u<<7 | u>>>(32-7);
                    u = x14 + x10 | 0;
                    x2 ^= u<<9 | u>>>(32-9);
                    u = x2 + x14 | 0;
                    x6 ^= u<<13 | u>>>(32-13);
                    u = x6 + x2 | 0;
                    x10 ^= u<<18 | u>>>(32-18);

                    u = x15 + x11 | 0;
                    x3 ^= u<<7 | u>>>(32-7);
                    u = x3 + x15 | 0;
                    x7 ^= u<<9 | u>>>(32-9);
                    u = x7 + x3 | 0;
                    x11 ^= u<<13 | u>>>(32-13);
                    u = x11 + x7 | 0;
                    x15 ^= u<<18 | u>>>(32-18);

                    u = x0 + x3 | 0;
                    x1 ^= u<<7 | u>>>(32-7);
                    u = x1 + x0 | 0;
                    x2 ^= u<<9 | u>>>(32-9);
                    u = x2 + x1 | 0;
                    x3 ^= u<<13 | u>>>(32-13);
                    u = x3 + x2 | 0;
                    x0 ^= u<<18 | u>>>(32-18);

                    u = x5 + x4 | 0;
                    x6 ^= u<<7 | u>>>(32-7);
                    u = x6 + x5 | 0;
                    x7 ^= u<<9 | u>>>(32-9);
                    u = x7 + x6 | 0;
                    x4 ^= u<<13 | u>>>(32-13);
                    u = x4 + x7 | 0;
                    x5 ^= u<<18 | u>>>(32-18);

                    u = x10 + x9 | 0;
                    x11 ^= u<<7 | u>>>(32-7);
                    u = x11 + x10 | 0;
                    x8 ^= u<<9 | u>>>(32-9);
                    u = x8 + x11 | 0;
                    x9 ^= u<<13 | u>>>(32-13);
                    u = x9 + x8 | 0;
                    x10 ^= u<<18 | u>>>(32-18);

                    u = x15 + x14 | 0;
                    x12 ^= u<<7 | u>>>(32-7);
                    u = x12 + x15 | 0;
                    x13 ^= u<<9 | u>>>(32-9);
                    u = x13 + x12 | 0;
                    x14 ^= u<<13 | u>>>(32-13);
                    u = x14 + x13 | 0;
                    x15 ^= u<<18 | u>>>(32-18);
                }
                x0 =  x0 +  j0 | 0;
                x1 =  x1 +  j1 | 0;
                x2 =  x2 +  j2 | 0;
                x3 =  x3 +  j3 | 0;
                x4 =  x4 +  j4 | 0;
                x5 =  x5 +  j5 | 0;
                x6 =  x6 +  j6 | 0;
                x7 =  x7 +  j7 | 0;
                x8 =  x8 +  j8 | 0;
                x9 =  x9 +  j9 | 0;
                x10 = x10 + j10 | 0;
                x11 = x11 + j11 | 0;
                x12 = x12 + j12 | 0;
                x13 = x13 + j13 | 0;
                x14 = x14 + j14 | 0;
                x15 = x15 + j15 | 0;

                o[ 0] = x0 >>>  0 & 0xff;
                o[ 1] = x0 >>>  8 & 0xff;
                o[ 2] = x0 >>> 16 & 0xff;
                o[ 3] = x0 >>> 24 & 0xff;

                o[ 4] = x1 >>>  0 & 0xff;
                o[ 5] = x1 >>>  8 & 0xff;
                o[ 6] = x1 >>> 16 & 0xff;
                o[ 7] = x1 >>> 24 & 0xff;

                o[ 8] = x2 >>>  0 & 0xff;
                o[ 9] = x2 >>>  8 & 0xff;
                o[10] = x2 >>> 16 & 0xff;
                o[11] = x2 >>> 24 & 0xff;

                o[12] = x3 >>>  0 & 0xff;
                o[13] = x3 >>>  8 & 0xff;
                o[14] = x3 >>> 16 & 0xff;
                o[15] = x3 >>> 24 & 0xff;

                o[16] = x4 >>>  0 & 0xff;
                o[17] = x4 >>>  8 & 0xff;
                o[18] = x4 >>> 16 & 0xff;
                o[19] = x4 >>> 24 & 0xff;

                o[20] = x5 >>>  0 & 0xff;
                o[21] = x5 >>>  8 & 0xff;
                o[22] = x5 >>> 16 & 0xff;
                o[23] = x5 >>> 24 & 0xff;

                o[24] = x6 >>>  0 & 0xff;
                o[25] = x6 >>>  8 & 0xff;
                o[26] = x6 >>> 16 & 0xff;
                o[27] = x6 >>> 24 & 0xff;

                o[28] = x7 >>>  0 & 0xff;
                o[29] = x7 >>>  8 & 0xff;
                o[30] = x7 >>> 16 & 0xff;
                o[31] = x7 >>> 24 & 0xff;

                o[32] = x8 >>>  0 & 0xff;
                o[33] = x8 >>>  8 & 0xff;
                o[34] = x8 >>> 16 & 0xff;
                o[35] = x8 >>> 24 & 0xff;

                o[36] = x9 >>>  0 & 0xff;
                o[37] = x9 >>>  8 & 0xff;
                o[38] = x9 >>> 16 & 0xff;
                o[39] = x9 >>> 24 & 0xff;

                o[40] = x10 >>>  0 & 0xff;
                o[41] = x10 >>>  8 & 0xff;
                o[42] = x10 >>> 16 & 0xff;
                o[43] = x10 >>> 24 & 0xff;

                o[44] = x11 >>>  0 & 0xff;
                o[45] = x11 >>>  8 & 0xff;
                o[46] = x11 >>> 16 & 0xff;
                o[47] = x11 >>> 24 & 0xff;

                o[48] = x12 >>>  0 & 0xff;
                o[49] = x12 >>>  8 & 0xff;
                o[50] = x12 >>> 16 & 0xff;
                o[51] = x12 >>> 24 & 0xff;

                o[52] = x13 >>>  0 & 0xff;
                o[53] = x13 >>>  8 & 0xff;
                o[54] = x13 >>> 16 & 0xff;
                o[55] = x13 >>> 24 & 0xff;

                o[56] = x14 >>>  0 & 0xff;
                o[57] = x14 >>>  8 & 0xff;
                o[58] = x14 >>> 16 & 0xff;
                o[59] = x14 >>> 24 & 0xff;

                o[60] = x15 >>>  0 & 0xff;
                o[61] = x15 >>>  8 & 0xff;
                o[62] = x15 >>> 16 & 0xff;
                o[63] = x15 >>> 24 & 0xff;
            }

            function core_hsalsa20(o,p,k,c) {
                var j0  = c[ 0] & 0xff | (c[ 1] & 0xff)<<8 | (c[ 2] & 0xff)<<16 | (c[ 3] & 0xff)<<24,
                    j1  = k[ 0] & 0xff | (k[ 1] & 0xff)<<8 | (k[ 2] & 0xff)<<16 | (k[ 3] & 0xff)<<24,
                    j2  = k[ 4] & 0xff | (k[ 5] & 0xff)<<8 | (k[ 6] & 0xff)<<16 | (k[ 7] & 0xff)<<24,
                    j3  = k[ 8] & 0xff | (k[ 9] & 0xff)<<8 | (k[10] & 0xff)<<16 | (k[11] & 0xff)<<24,
                    j4  = k[12] & 0xff | (k[13] & 0xff)<<8 | (k[14] & 0xff)<<16 | (k[15] & 0xff)<<24,
                    j5  = c[ 4] & 0xff | (c[ 5] & 0xff)<<8 | (c[ 6] & 0xff)<<16 | (c[ 7] & 0xff)<<24,
                    j6  = p[ 0] & 0xff | (p[ 1] & 0xff)<<8 | (p[ 2] & 0xff)<<16 | (p[ 3] & 0xff)<<24,
                    j7  = p[ 4] & 0xff | (p[ 5] & 0xff)<<8 | (p[ 6] & 0xff)<<16 | (p[ 7] & 0xff)<<24,
                    j8  = p[ 8] & 0xff | (p[ 9] & 0xff)<<8 | (p[10] & 0xff)<<16 | (p[11] & 0xff)<<24,
                    j9  = p[12] & 0xff | (p[13] & 0xff)<<8 | (p[14] & 0xff)<<16 | (p[15] & 0xff)<<24,
                    j10 = c[ 8] & 0xff | (c[ 9] & 0xff)<<8 | (c[10] & 0xff)<<16 | (c[11] & 0xff)<<24,
                    j11 = k[16] & 0xff | (k[17] & 0xff)<<8 | (k[18] & 0xff)<<16 | (k[19] & 0xff)<<24,
                    j12 = k[20] & 0xff | (k[21] & 0xff)<<8 | (k[22] & 0xff)<<16 | (k[23] & 0xff)<<24,
                    j13 = k[24] & 0xff | (k[25] & 0xff)<<8 | (k[26] & 0xff)<<16 | (k[27] & 0xff)<<24,
                    j14 = k[28] & 0xff | (k[29] & 0xff)<<8 | (k[30] & 0xff)<<16 | (k[31] & 0xff)<<24,
                    j15 = c[12] & 0xff | (c[13] & 0xff)<<8 | (c[14] & 0xff)<<16 | (c[15] & 0xff)<<24;

                var x0 = j0, x1 = j1, x2 = j2, x3 = j3, x4 = j4, x5 = j5, x6 = j6, x7 = j7,
                    x8 = j8, x9 = j9, x10 = j10, x11 = j11, x12 = j12, x13 = j13, x14 = j14,
                    x15 = j15, u;

                for (var i = 0; i < 20; i += 2) {
                    u = x0 + x12 | 0;
                    x4 ^= u<<7 | u>>>(32-7);
                    u = x4 + x0 | 0;
                    x8 ^= u<<9 | u>>>(32-9);
                    u = x8 + x4 | 0;
                    x12 ^= u<<13 | u>>>(32-13);
                    u = x12 + x8 | 0;
                    x0 ^= u<<18 | u>>>(32-18);

                    u = x5 + x1 | 0;
                    x9 ^= u<<7 | u>>>(32-7);
                    u = x9 + x5 | 0;
                    x13 ^= u<<9 | u>>>(32-9);
                    u = x13 + x9 | 0;
                    x1 ^= u<<13 | u>>>(32-13);
                    u = x1 + x13 | 0;
                    x5 ^= u<<18 | u>>>(32-18);

                    u = x10 + x6 | 0;
                    x14 ^= u<<7 | u>>>(32-7);
                    u = x14 + x10 | 0;
                    x2 ^= u<<9 | u>>>(32-9);
                    u = x2 + x14 | 0;
                    x6 ^= u<<13 | u>>>(32-13);
                    u = x6 + x2 | 0;
                    x10 ^= u<<18 | u>>>(32-18);

                    u = x15 + x11 | 0;
                    x3 ^= u<<7 | u>>>(32-7);
                    u = x3 + x15 | 0;
                    x7 ^= u<<9 | u>>>(32-9);
                    u = x7 + x3 | 0;
                    x11 ^= u<<13 | u>>>(32-13);
                    u = x11 + x7 | 0;
                    x15 ^= u<<18 | u>>>(32-18);

                    u = x0 + x3 | 0;
                    x1 ^= u<<7 | u>>>(32-7);
                    u = x1 + x0 | 0;
                    x2 ^= u<<9 | u>>>(32-9);
                    u = x2 + x1 | 0;
                    x3 ^= u<<13 | u>>>(32-13);
                    u = x3 + x2 | 0;
                    x0 ^= u<<18 | u>>>(32-18);

                    u = x5 + x4 | 0;
                    x6 ^= u<<7 | u>>>(32-7);
                    u = x6 + x5 | 0;
                    x7 ^= u<<9 | u>>>(32-9);
                    u = x7 + x6 | 0;
                    x4 ^= u<<13 | u>>>(32-13);
                    u = x4 + x7 | 0;
                    x5 ^= u<<18 | u>>>(32-18);

                    u = x10 + x9 | 0;
                    x11 ^= u<<7 | u>>>(32-7);
                    u = x11 + x10 | 0;
                    x8 ^= u<<9 | u>>>(32-9);
                    u = x8 + x11 | 0;
                    x9 ^= u<<13 | u>>>(32-13);
                    u = x9 + x8 | 0;
                    x10 ^= u<<18 | u>>>(32-18);

                    u = x15 + x14 | 0;
                    x12 ^= u<<7 | u>>>(32-7);
                    u = x12 + x15 | 0;
                    x13 ^= u<<9 | u>>>(32-9);
                    u = x13 + x12 | 0;
                    x14 ^= u<<13 | u>>>(32-13);
                    u = x14 + x13 | 0;
                    x15 ^= u<<18 | u>>>(32-18);
                }

                o[ 0] = x0 >>>  0 & 0xff;
                o[ 1] = x0 >>>  8 & 0xff;
                o[ 2] = x0 >>> 16 & 0xff;
                o[ 3] = x0 >>> 24 & 0xff;

                o[ 4] = x5 >>>  0 & 0xff;
                o[ 5] = x5 >>>  8 & 0xff;
                o[ 6] = x5 >>> 16 & 0xff;
                o[ 7] = x5 >>> 24 & 0xff;

                o[ 8] = x10 >>>  0 & 0xff;
                o[ 9] = x10 >>>  8 & 0xff;
                o[10] = x10 >>> 16 & 0xff;
                o[11] = x10 >>> 24 & 0xff;

                o[12] = x15 >>>  0 & 0xff;
                o[13] = x15 >>>  8 & 0xff;
                o[14] = x15 >>> 16 & 0xff;
                o[15] = x15 >>> 24 & 0xff;

                o[16] = x6 >>>  0 & 0xff;
                o[17] = x6 >>>  8 & 0xff;
                o[18] = x6 >>> 16 & 0xff;
                o[19] = x6 >>> 24 & 0xff;

                o[20] = x7 >>>  0 & 0xff;
                o[21] = x7 >>>  8 & 0xff;
                o[22] = x7 >>> 16 & 0xff;
                o[23] = x7 >>> 24 & 0xff;

                o[24] = x8 >>>  0 & 0xff;
                o[25] = x8 >>>  8 & 0xff;
                o[26] = x8 >>> 16 & 0xff;
                o[27] = x8 >>> 24 & 0xff;

                o[28] = x9 >>>  0 & 0xff;
                o[29] = x9 >>>  8 & 0xff;
                o[30] = x9 >>> 16 & 0xff;
                o[31] = x9 >>> 24 & 0xff;
            }

            function crypto_core_salsa20(out,inp,k,c) {
                core_salsa20(out,inp,k,c);
            }

            function crypto_core_hsalsa20(out,inp,k,c) {
                core_hsalsa20(out,inp,k,c);
            }

            var sigma = new Uint8Array([101, 120, 112, 97, 110, 100, 32, 51, 50, 45, 98, 121, 116, 101, 32, 107]);
            // "expand 32-byte k"

            function crypto_stream_salsa20_xor(c,cpos,m,mpos,b,n,k) {
                var z = new Uint8Array(16), x = new Uint8Array(64);
                var u, i;
                for (i = 0; i < 16; i++) z[i] = 0;
                for (i = 0; i < 8; i++) z[i] = n[i];
                while (b >= 64) {
                    crypto_core_salsa20(x,z,k,sigma);
                    for (i = 0; i < 64; i++) c[cpos+i] = m[mpos+i] ^ x[i];
                    u = 1;
                    for (i = 8; i < 16; i++) {
                        u = u + (z[i] & 0xff) | 0;
                        z[i] = u & 0xff;
                        u >>>= 8;
                    }
                    b -= 64;
                    cpos += 64;
                    mpos += 64;
                }
                if (b > 0) {
                    crypto_core_salsa20(x,z,k,sigma);
                    for (i = 0; i < b; i++) c[cpos+i] = m[mpos+i] ^ x[i];
                }
                return 0;
            }

            function crypto_stream_salsa20(c,cpos,b,n,k) {
                var z = new Uint8Array(16), x = new Uint8Array(64);
                var u, i;
                for (i = 0; i < 16; i++) z[i] = 0;
                for (i = 0; i < 8; i++) z[i] = n[i];
                while (b >= 64) {
                    crypto_core_salsa20(x,z,k,sigma);
                    for (i = 0; i < 64; i++) c[cpos+i] = x[i];
                    u = 1;
                    for (i = 8; i < 16; i++) {
                        u = u + (z[i] & 0xff) | 0;
                        z[i] = u & 0xff;
                        u >>>= 8;
                    }
                    b -= 64;
                    cpos += 64;
                }
                if (b > 0) {
                    crypto_core_salsa20(x,z,k,sigma);
                    for (i = 0; i < b; i++) c[cpos+i] = x[i];
                }
                return 0;
            }

            function crypto_stream(c,cpos,d,n,k) {
                var s = new Uint8Array(32);
                crypto_core_hsalsa20(s,n,k,sigma);
                var sn = new Uint8Array(8);
                for (var i = 0; i < 8; i++) sn[i] = n[i+16];
                return crypto_stream_salsa20(c,cpos,d,sn,s);
            }

            function crypto_stream_xor(c,cpos,m,mpos,d,n,k) {
                var s = new Uint8Array(32);
                crypto_core_hsalsa20(s,n,k,sigma);
                var sn = new Uint8Array(8);
                for (var i = 0; i < 8; i++) sn[i] = n[i+16];
                return crypto_stream_salsa20_xor(c,cpos,m,mpos,d,sn,s);
            }

            /*
             * Port of Andrew Moon's Poly1305-donna-16. Public domain.
             * https://github.com/floodyberry/poly1305-donna
             */

            var poly1305 = function(key) {
                this.buffer = new Uint8Array(16);
                this.r = new Uint16Array(10);
                this.h = new Uint16Array(10);
                this.pad = new Uint16Array(8);
                this.leftover = 0;
                this.fin = 0;

                var t0, t1, t2, t3, t4, t5, t6, t7;

                t0 = key[ 0] & 0xff | (key[ 1] & 0xff) << 8; this.r[0] = ( t0                     ) & 0x1fff;
                t1 = key[ 2] & 0xff | (key[ 3] & 0xff) << 8; this.r[1] = ((t0 >>> 13) | (t1 <<  3)) & 0x1fff;
                t2 = key[ 4] & 0xff | (key[ 5] & 0xff) << 8; this.r[2] = ((t1 >>> 10) | (t2 <<  6)) & 0x1f03;
                t3 = key[ 6] & 0xff | (key[ 7] & 0xff) << 8; this.r[3] = ((t2 >>>  7) | (t3 <<  9)) & 0x1fff;
                t4 = key[ 8] & 0xff | (key[ 9] & 0xff) << 8; this.r[4] = ((t3 >>>  4) | (t4 << 12)) & 0x00ff;
                this.r[5] = ((t4 >>>  1)) & 0x1ffe;
                t5 = key[10] & 0xff | (key[11] & 0xff) << 8; this.r[6] = ((t4 >>> 14) | (t5 <<  2)) & 0x1fff;
                t6 = key[12] & 0xff | (key[13] & 0xff) << 8; this.r[7] = ((t5 >>> 11) | (t6 <<  5)) & 0x1f81;
                t7 = key[14] & 0xff | (key[15] & 0xff) << 8; this.r[8] = ((t6 >>>  8) | (t7 <<  8)) & 0x1fff;
                this.r[9] = ((t7 >>>  5)) & 0x007f;

                this.pad[0] = key[16] & 0xff | (key[17] & 0xff) << 8;
                this.pad[1] = key[18] & 0xff | (key[19] & 0xff) << 8;
                this.pad[2] = key[20] & 0xff | (key[21] & 0xff) << 8;
                this.pad[3] = key[22] & 0xff | (key[23] & 0xff) << 8;
                this.pad[4] = key[24] & 0xff | (key[25] & 0xff) << 8;
                this.pad[5] = key[26] & 0xff | (key[27] & 0xff) << 8;
                this.pad[6] = key[28] & 0xff | (key[29] & 0xff) << 8;
                this.pad[7] = key[30] & 0xff | (key[31] & 0xff) << 8;
            };

            poly1305.prototype.blocks = function(m, mpos, bytes) {
                var hibit = this.fin ? 0 : (1 << 11);
                var t0, t1, t2, t3, t4, t5, t6, t7, c;
                var d0, d1, d2, d3, d4, d5, d6, d7, d8, d9;

                var h0 = this.h[0],
                    h1 = this.h[1],
                    h2 = this.h[2],
                    h3 = this.h[3],
                    h4 = this.h[4],
                    h5 = this.h[5],
                    h6 = this.h[6],
                    h7 = this.h[7],
                    h8 = this.h[8],
                    h9 = this.h[9];

                var r0 = this.r[0],
                    r1 = this.r[1],
                    r2 = this.r[2],
                    r3 = this.r[3],
                    r4 = this.r[4],
                    r5 = this.r[5],
                    r6 = this.r[6],
                    r7 = this.r[7],
                    r8 = this.r[8],
                    r9 = this.r[9];

                while (bytes >= 16) {
                    t0 = m[mpos+ 0] & 0xff | (m[mpos+ 1] & 0xff) << 8; h0 += ( t0                     ) & 0x1fff;
                    t1 = m[mpos+ 2] & 0xff | (m[mpos+ 3] & 0xff) << 8; h1 += ((t0 >>> 13) | (t1 <<  3)) & 0x1fff;
                    t2 = m[mpos+ 4] & 0xff | (m[mpos+ 5] & 0xff) << 8; h2 += ((t1 >>> 10) | (t2 <<  6)) & 0x1fff;
                    t3 = m[mpos+ 6] & 0xff | (m[mpos+ 7] & 0xff) << 8; h3 += ((t2 >>>  7) | (t3 <<  9)) & 0x1fff;
                    t4 = m[mpos+ 8] & 0xff | (m[mpos+ 9] & 0xff) << 8; h4 += ((t3 >>>  4) | (t4 << 12)) & 0x1fff;
                    h5 += ((t4 >>>  1)) & 0x1fff;
                    t5 = m[mpos+10] & 0xff | (m[mpos+11] & 0xff) << 8; h6 += ((t4 >>> 14) | (t5 <<  2)) & 0x1fff;
                    t6 = m[mpos+12] & 0xff | (m[mpos+13] & 0xff) << 8; h7 += ((t5 >>> 11) | (t6 <<  5)) & 0x1fff;
                    t7 = m[mpos+14] & 0xff | (m[mpos+15] & 0xff) << 8; h8 += ((t6 >>>  8) | (t7 <<  8)) & 0x1fff;
                    h9 += ((t7 >>> 5)) | hibit;

                    c = 0;

                    d0 = c;
                    d0 += h0 * r0;
                    d0 += h1 * (5 * r9);
                    d0 += h2 * (5 * r8);
                    d0 += h3 * (5 * r7);
                    d0 += h4 * (5 * r6);
                    c = (d0 >>> 13); d0 &= 0x1fff;
                    d0 += h5 * (5 * r5);
                    d0 += h6 * (5 * r4);
                    d0 += h7 * (5 * r3);
                    d0 += h8 * (5 * r2);
                    d0 += h9 * (5 * r1);
                    c += (d0 >>> 13); d0 &= 0x1fff;

                    d1 = c;
                    d1 += h0 * r1;
                    d1 += h1 * r0;
                    d1 += h2 * (5 * r9);
                    d1 += h3 * (5 * r8);
                    d1 += h4 * (5 * r7);
                    c = (d1 >>> 13); d1 &= 0x1fff;
                    d1 += h5 * (5 * r6);
                    d1 += h6 * (5 * r5);
                    d1 += h7 * (5 * r4);
                    d1 += h8 * (5 * r3);
                    d1 += h9 * (5 * r2);
                    c += (d1 >>> 13); d1 &= 0x1fff;

                    d2 = c;
                    d2 += h0 * r2;
                    d2 += h1 * r1;
                    d2 += h2 * r0;
                    d2 += h3 * (5 * r9);
                    d2 += h4 * (5 * r8);
                    c = (d2 >>> 13); d2 &= 0x1fff;
                    d2 += h5 * (5 * r7);
                    d2 += h6 * (5 * r6);
                    d2 += h7 * (5 * r5);
                    d2 += h8 * (5 * r4);
                    d2 += h9 * (5 * r3);
                    c += (d2 >>> 13); d2 &= 0x1fff;

                    d3 = c;
                    d3 += h0 * r3;
                    d3 += h1 * r2;
                    d3 += h2 * r1;
                    d3 += h3 * r0;
                    d3 += h4 * (5 * r9);
                    c = (d3 >>> 13); d3 &= 0x1fff;
                    d3 += h5 * (5 * r8);
                    d3 += h6 * (5 * r7);
                    d3 += h7 * (5 * r6);
                    d3 += h8 * (5 * r5);
                    d3 += h9 * (5 * r4);
                    c += (d3 >>> 13); d3 &= 0x1fff;

                    d4 = c;
                    d4 += h0 * r4;
                    d4 += h1 * r3;
                    d4 += h2 * r2;
                    d4 += h3 * r1;
                    d4 += h4 * r0;
                    c = (d4 >>> 13); d4 &= 0x1fff;
                    d4 += h5 * (5 * r9);
                    d4 += h6 * (5 * r8);
                    d4 += h7 * (5 * r7);
                    d4 += h8 * (5 * r6);
                    d4 += h9 * (5 * r5);
                    c += (d4 >>> 13); d4 &= 0x1fff;

                    d5 = c;
                    d5 += h0 * r5;
                    d5 += h1 * r4;
                    d5 += h2 * r3;
                    d5 += h3 * r2;
                    d5 += h4 * r1;
                    c = (d5 >>> 13); d5 &= 0x1fff;
                    d5 += h5 * r0;
                    d5 += h6 * (5 * r9);
                    d5 += h7 * (5 * r8);
                    d5 += h8 * (5 * r7);
                    d5 += h9 * (5 * r6);
                    c += (d5 >>> 13); d5 &= 0x1fff;

                    d6 = c;
                    d6 += h0 * r6;
                    d6 += h1 * r5;
                    d6 += h2 * r4;
                    d6 += h3 * r3;
                    d6 += h4 * r2;
                    c = (d6 >>> 13); d6 &= 0x1fff;
                    d6 += h5 * r1;
                    d6 += h6 * r0;
                    d6 += h7 * (5 * r9);
                    d6 += h8 * (5 * r8);
                    d6 += h9 * (5 * r7);
                    c += (d6 >>> 13); d6 &= 0x1fff;

                    d7 = c;
                    d7 += h0 * r7;
                    d7 += h1 * r6;
                    d7 += h2 * r5;
                    d7 += h3 * r4;
                    d7 += h4 * r3;
                    c = (d7 >>> 13); d7 &= 0x1fff;
                    d7 += h5 * r2;
                    d7 += h6 * r1;
                    d7 += h7 * r0;
                    d7 += h8 * (5 * r9);
                    d7 += h9 * (5 * r8);
                    c += (d7 >>> 13); d7 &= 0x1fff;

                    d8 = c;
                    d8 += h0 * r8;
                    d8 += h1 * r7;
                    d8 += h2 * r6;
                    d8 += h3 * r5;
                    d8 += h4 * r4;
                    c = (d8 >>> 13); d8 &= 0x1fff;
                    d8 += h5 * r3;
                    d8 += h6 * r2;
                    d8 += h7 * r1;
                    d8 += h8 * r0;
                    d8 += h9 * (5 * r9);
                    c += (d8 >>> 13); d8 &= 0x1fff;

                    d9 = c;
                    d9 += h0 * r9;
                    d9 += h1 * r8;
                    d9 += h2 * r7;
                    d9 += h3 * r6;
                    d9 += h4 * r5;
                    c = (d9 >>> 13); d9 &= 0x1fff;
                    d9 += h5 * r4;
                    d9 += h6 * r3;
                    d9 += h7 * r2;
                    d9 += h8 * r1;
                    d9 += h9 * r0;
                    c += (d9 >>> 13); d9 &= 0x1fff;

                    c = (((c << 2) + c)) | 0;
                    c = (c + d0) | 0;
                    d0 = c & 0x1fff;
                    c = (c >>> 13);
                    d1 += c;

                    h0 = d0;
                    h1 = d1;
                    h2 = d2;
                    h3 = d3;
                    h4 = d4;
                    h5 = d5;
                    h6 = d6;
                    h7 = d7;
                    h8 = d8;
                    h9 = d9;

                    mpos += 16;
                    bytes -= 16;
                }
                this.h[0] = h0;
                this.h[1] = h1;
                this.h[2] = h2;
                this.h[3] = h3;
                this.h[4] = h4;
                this.h[5] = h5;
                this.h[6] = h6;
                this.h[7] = h7;
                this.h[8] = h8;
                this.h[9] = h9;
            };

            poly1305.prototype.finish = function(mac, macpos) {
                var g = new Uint16Array(10);
                var c, mask, f, i;

                if (this.leftover) {
                    i = this.leftover;
                    this.buffer[i++] = 1;
                    for (; i < 16; i++) this.buffer[i] = 0;
                    this.fin = 1;
                    this.blocks(this.buffer, 0, 16);
                }

                c = this.h[1] >>> 13;
                this.h[1] &= 0x1fff;
                for (i = 2; i < 10; i++) {
                    this.h[i] += c;
                    c = this.h[i] >>> 13;
                    this.h[i] &= 0x1fff;
                }
                this.h[0] += (c * 5);
                c = this.h[0] >>> 13;
                this.h[0] &= 0x1fff;
                this.h[1] += c;
                c = this.h[1] >>> 13;
                this.h[1] &= 0x1fff;
                this.h[2] += c;

                g[0] = this.h[0] + 5;
                c = g[0] >>> 13;
                g[0] &= 0x1fff;
                for (i = 1; i < 10; i++) {
                    g[i] = this.h[i] + c;
                    c = g[i] >>> 13;
                    g[i] &= 0x1fff;
                }
                g[9] -= (1 << 13);

                mask = (g[9] >>> ((2 * 8) - 1)) - 1;
                for (i = 0; i < 10; i++) g[i] &= mask;
                mask = ~mask;
                for (i = 0; i < 10; i++) this.h[i] = (this.h[i] & mask) | g[i];

                this.h[0] = ((this.h[0]       ) | (this.h[1] << 13)                    ) & 0xffff;
                this.h[1] = ((this.h[1] >>>  3) | (this.h[2] << 10)                    ) & 0xffff;
                this.h[2] = ((this.h[2] >>>  6) | (this.h[3] <<  7)                    ) & 0xffff;
                this.h[3] = ((this.h[3] >>>  9) | (this.h[4] <<  4)                    ) & 0xffff;
                this.h[4] = ((this.h[4] >>> 12) | (this.h[5] <<  1) | (this.h[6] << 14)) & 0xffff;
                this.h[5] = ((this.h[6] >>>  2) | (this.h[7] << 11)                    ) & 0xffff;
                this.h[6] = ((this.h[7] >>>  5) | (this.h[8] <<  8)                    ) & 0xffff;
                this.h[7] = ((this.h[8] >>>  8) | (this.h[9] <<  5)                    ) & 0xffff;

                f = this.h[0] + this.pad[0];
                this.h[0] = f & 0xffff;
                for (i = 1; i < 8; i++) {
                    f = (((this.h[i] + this.pad[i]) | 0) + (f >>> 16)) | 0;
                    this.h[i] = f & 0xffff;
                }

                mac[macpos+ 0] = (this.h[0] >>> 0) & 0xff;
                mac[macpos+ 1] = (this.h[0] >>> 8) & 0xff;
                mac[macpos+ 2] = (this.h[1] >>> 0) & 0xff;
                mac[macpos+ 3] = (this.h[1] >>> 8) & 0xff;
                mac[macpos+ 4] = (this.h[2] >>> 0) & 0xff;
                mac[macpos+ 5] = (this.h[2] >>> 8) & 0xff;
                mac[macpos+ 6] = (this.h[3] >>> 0) & 0xff;
                mac[macpos+ 7] = (this.h[3] >>> 8) & 0xff;
                mac[macpos+ 8] = (this.h[4] >>> 0) & 0xff;
                mac[macpos+ 9] = (this.h[4] >>> 8) & 0xff;
                mac[macpos+10] = (this.h[5] >>> 0) & 0xff;
                mac[macpos+11] = (this.h[5] >>> 8) & 0xff;
                mac[macpos+12] = (this.h[6] >>> 0) & 0xff;
                mac[macpos+13] = (this.h[6] >>> 8) & 0xff;
                mac[macpos+14] = (this.h[7] >>> 0) & 0xff;
                mac[macpos+15] = (this.h[7] >>> 8) & 0xff;
            };

            poly1305.prototype.update = function(m, mpos, bytes) {
                var i, want;

                if (this.leftover) {
                    want = (16 - this.leftover);
                    if (want > bytes)
                        want = bytes;
                    for (i = 0; i < want; i++)
                        this.buffer[this.leftover + i] = m[mpos+i];
                    bytes -= want;
                    mpos += want;
                    this.leftover += want;
                    if (this.leftover < 16)
                        return;
                    this.blocks(this.buffer, 0, 16);
                    this.leftover = 0;
                }

                if (bytes >= 16) {
                    want = bytes - (bytes % 16);
                    this.blocks(m, mpos, want);
                    mpos += want;
                    bytes -= want;
                }

                if (bytes) {
                    for (i = 0; i < bytes; i++)
                        this.buffer[this.leftover + i] = m[mpos+i];
                    this.leftover += bytes;
                }
            };

            function crypto_onetimeauth(out, outpos, m, mpos, n, k) {
                var s = new poly1305(k);
                s.update(m, mpos, n);
                s.finish(out, outpos);
                return 0;
            }

            function crypto_onetimeauth_verify(h, hpos, m, mpos, n, k) {
                var x = new Uint8Array(16);
                crypto_onetimeauth(x,0,m,mpos,n,k);
                return crypto_verify_16(h,hpos,x,0);
            }

            function crypto_secretbox(c,m,d,n,k) {
                var i;
                if (d < 32) return -1;
                crypto_stream_xor(c,0,m,0,d,n,k);
                crypto_onetimeauth(c, 16, c, 32, d - 32, c);
                for (i = 0; i < 16; i++) c[i] = 0;
                return 0;
            }

            function crypto_secretbox_open(m,c,d,n,k) {
                var i;
                var x = new Uint8Array(32);
                if (d < 32) return -1;
                crypto_stream(x,0,32,n,k);
                if (crypto_onetimeauth_verify(c, 16,c, 32,d - 32,x) !== 0) return -1;
                crypto_stream_xor(m,0,c,0,d,n,k);
                for (i = 0; i < 32; i++) m[i] = 0;
                return 0;
            }

            function set25519(r, a) {
                var i;
                for (i = 0; i < 16; i++) r[i] = a[i]|0;
            }

            function car25519(o) {
                var i, v, c = 1;
                for (i = 0; i < 16; i++) {
                    v = o[i] + c + 65535;
                    c = Math.floor(v / 65536);
                    o[i] = v - c * 65536;
                }
                o[0] += c-1 + 37 * (c-1);
            }

            function sel25519(p, q, b) {
                var t, c = ~(b-1);
                for (var i = 0; i < 16; i++) {
                    t = c & (p[i] ^ q[i]);
                    p[i] ^= t;
                    q[i] ^= t;
                }
            }

            function pack25519(o, n) {
                var i, j, b;
                var m = gf(), t = gf();
                for (i = 0; i < 16; i++) t[i] = n[i];
                car25519(t);
                car25519(t);
                car25519(t);
                for (j = 0; j < 2; j++) {
                    m[0] = t[0] - 0xffed;
                    for (i = 1; i < 15; i++) {
                        m[i] = t[i] - 0xffff - ((m[i-1]>>16) & 1);
                        m[i-1] &= 0xffff;
                    }
                    m[15] = t[15] - 0x7fff - ((m[14]>>16) & 1);
                    b = (m[15]>>16) & 1;
                    m[14] &= 0xffff;
                    sel25519(t, m, 1-b);
                }
                for (i = 0; i < 16; i++) {
                    o[2*i] = t[i] & 0xff;
                    o[2*i+1] = t[i]>>8;
                }
            }

            function neq25519(a, b) {
                var c = new Uint8Array(32), d = new Uint8Array(32);
                pack25519(c, a);
                pack25519(d, b);
                return crypto_verify_32(c, 0, d, 0);
            }

            function par25519(a) {
                var d = new Uint8Array(32);
                pack25519(d, a);
                return d[0] & 1;
            }

            function unpack25519(o, n) {
                var i;
                for (i = 0; i < 16; i++) o[i] = n[2*i] + (n[2*i+1] << 8);
                o[15] &= 0x7fff;
            }

            function A(o, a, b) {
                for (var i = 0; i < 16; i++) o[i] = a[i] + b[i];
            }

            function Z(o, a, b) {
                for (var i = 0; i < 16; i++) o[i] = a[i] - b[i];
            }

            function M(o, a, b) {
                var v, c,
                    t0 = 0,  t1 = 0,  t2 = 0,  t3 = 0,  t4 = 0,  t5 = 0,  t6 = 0,  t7 = 0,
                    t8 = 0,  t9 = 0, t10 = 0, t11 = 0, t12 = 0, t13 = 0, t14 = 0, t15 = 0,
                    t16 = 0, t17 = 0, t18 = 0, t19 = 0, t20 = 0, t21 = 0, t22 = 0, t23 = 0,
                    t24 = 0, t25 = 0, t26 = 0, t27 = 0, t28 = 0, t29 = 0, t30 = 0,
                    b0 = b[0],
                    b1 = b[1],
                    b2 = b[2],
                    b3 = b[3],
                    b4 = b[4],
                    b5 = b[5],
                    b6 = b[6],
                    b7 = b[7],
                    b8 = b[8],
                    b9 = b[9],
                    b10 = b[10],
                    b11 = b[11],
                    b12 = b[12],
                    b13 = b[13],
                    b14 = b[14],
                    b15 = b[15];

                v = a[0];
                t0 += v * b0;
                t1 += v * b1;
                t2 += v * b2;
                t3 += v * b3;
                t4 += v * b4;
                t5 += v * b5;
                t6 += v * b6;
                t7 += v * b7;
                t8 += v * b8;
                t9 += v * b9;
                t10 += v * b10;
                t11 += v * b11;
                t12 += v * b12;
                t13 += v * b13;
                t14 += v * b14;
                t15 += v * b15;
                v = a[1];
                t1 += v * b0;
                t2 += v * b1;
                t3 += v * b2;
                t4 += v * b3;
                t5 += v * b4;
                t6 += v * b5;
                t7 += v * b6;
                t8 += v * b7;
                t9 += v * b8;
                t10 += v * b9;
                t11 += v * b10;
                t12 += v * b11;
                t13 += v * b12;
                t14 += v * b13;
                t15 += v * b14;
                t16 += v * b15;
                v = a[2];
                t2 += v * b0;
                t3 += v * b1;
                t4 += v * b2;
                t5 += v * b3;
                t6 += v * b4;
                t7 += v * b5;
                t8 += v * b6;
                t9 += v * b7;
                t10 += v * b8;
                t11 += v * b9;
                t12 += v * b10;
                t13 += v * b11;
                t14 += v * b12;
                t15 += v * b13;
                t16 += v * b14;
                t17 += v * b15;
                v = a[3];
                t3 += v * b0;
                t4 += v * b1;
                t5 += v * b2;
                t6 += v * b3;
                t7 += v * b4;
                t8 += v * b5;
                t9 += v * b6;
                t10 += v * b7;
                t11 += v * b8;
                t12 += v * b9;
                t13 += v * b10;
                t14 += v * b11;
                t15 += v * b12;
                t16 += v * b13;
                t17 += v * b14;
                t18 += v * b15;
                v = a[4];
                t4 += v * b0;
                t5 += v * b1;
                t6 += v * b2;
                t7 += v * b3;
                t8 += v * b4;
                t9 += v * b5;
                t10 += v * b6;
                t11 += v * b7;
                t12 += v * b8;
                t13 += v * b9;
                t14 += v * b10;
                t15 += v * b11;
                t16 += v * b12;
                t17 += v * b13;
                t18 += v * b14;
                t19 += v * b15;
                v = a[5];
                t5 += v * b0;
                t6 += v * b1;
                t7 += v * b2;
                t8 += v * b3;
                t9 += v * b4;
                t10 += v * b5;
                t11 += v * b6;
                t12 += v * b7;
                t13 += v * b8;
                t14 += v * b9;
                t15 += v * b10;
                t16 += v * b11;
                t17 += v * b12;
                t18 += v * b13;
                t19 += v * b14;
                t20 += v * b15;
                v = a[6];
                t6 += v * b0;
                t7 += v * b1;
                t8 += v * b2;
                t9 += v * b3;
                t10 += v * b4;
                t11 += v * b5;
                t12 += v * b6;
                t13 += v * b7;
                t14 += v * b8;
                t15 += v * b9;
                t16 += v * b10;
                t17 += v * b11;
                t18 += v * b12;
                t19 += v * b13;
                t20 += v * b14;
                t21 += v * b15;
                v = a[7];
                t7 += v * b0;
                t8 += v * b1;
                t9 += v * b2;
                t10 += v * b3;
                t11 += v * b4;
                t12 += v * b5;
                t13 += v * b6;
                t14 += v * b7;
                t15 += v * b8;
                t16 += v * b9;
                t17 += v * b10;
                t18 += v * b11;
                t19 += v * b12;
                t20 += v * b13;
                t21 += v * b14;
                t22 += v * b15;
                v = a[8];
                t8 += v * b0;
                t9 += v * b1;
                t10 += v * b2;
                t11 += v * b3;
                t12 += v * b4;
                t13 += v * b5;
                t14 += v * b6;
                t15 += v * b7;
                t16 += v * b8;
                t17 += v * b9;
                t18 += v * b10;
                t19 += v * b11;
                t20 += v * b12;
                t21 += v * b13;
                t22 += v * b14;
                t23 += v * b15;
                v = a[9];
                t9 += v * b0;
                t10 += v * b1;
                t11 += v * b2;
                t12 += v * b3;
                t13 += v * b4;
                t14 += v * b5;
                t15 += v * b6;
                t16 += v * b7;
                t17 += v * b8;
                t18 += v * b9;
                t19 += v * b10;
                t20 += v * b11;
                t21 += v * b12;
                t22 += v * b13;
                t23 += v * b14;
                t24 += v * b15;
                v = a[10];
                t10 += v * b0;
                t11 += v * b1;
                t12 += v * b2;
                t13 += v * b3;
                t14 += v * b4;
                t15 += v * b5;
                t16 += v * b6;
                t17 += v * b7;
                t18 += v * b8;
                t19 += v * b9;
                t20 += v * b10;
                t21 += v * b11;
                t22 += v * b12;
                t23 += v * b13;
                t24 += v * b14;
                t25 += v * b15;
                v = a[11];
                t11 += v * b0;
                t12 += v * b1;
                t13 += v * b2;
                t14 += v * b3;
                t15 += v * b4;
                t16 += v * b5;
                t17 += v * b6;
                t18 += v * b7;
                t19 += v * b8;
                t20 += v * b9;
                t21 += v * b10;
                t22 += v * b11;
                t23 += v * b12;
                t24 += v * b13;
                t25 += v * b14;
                t26 += v * b15;
                v = a[12];
                t12 += v * b0;
                t13 += v * b1;
                t14 += v * b2;
                t15 += v * b3;
                t16 += v * b4;
                t17 += v * b5;
                t18 += v * b6;
                t19 += v * b7;
                t20 += v * b8;
                t21 += v * b9;
                t22 += v * b10;
                t23 += v * b11;
                t24 += v * b12;
                t25 += v * b13;
                t26 += v * b14;
                t27 += v * b15;
                v = a[13];
                t13 += v * b0;
                t14 += v * b1;
                t15 += v * b2;
                t16 += v * b3;
                t17 += v * b4;
                t18 += v * b5;
                t19 += v * b6;
                t20 += v * b7;
                t21 += v * b8;
                t22 += v * b9;
                t23 += v * b10;
                t24 += v * b11;
                t25 += v * b12;
                t26 += v * b13;
                t27 += v * b14;
                t28 += v * b15;
                v = a[14];
                t14 += v * b0;
                t15 += v * b1;
                t16 += v * b2;
                t17 += v * b3;
                t18 += v * b4;
                t19 += v * b5;
                t20 += v * b6;
                t21 += v * b7;
                t22 += v * b8;
                t23 += v * b9;
                t24 += v * b10;
                t25 += v * b11;
                t26 += v * b12;
                t27 += v * b13;
                t28 += v * b14;
                t29 += v * b15;
                v = a[15];
                t15 += v * b0;
                t16 += v * b1;
                t17 += v * b2;
                t18 += v * b3;
                t19 += v * b4;
                t20 += v * b5;
                t21 += v * b6;
                t22 += v * b7;
                t23 += v * b8;
                t24 += v * b9;
                t25 += v * b10;
                t26 += v * b11;
                t27 += v * b12;
                t28 += v * b13;
                t29 += v * b14;
                t30 += v * b15;

                t0  += 38 * t16;
                t1  += 38 * t17;
                t2  += 38 * t18;
                t3  += 38 * t19;
                t4  += 38 * t20;
                t5  += 38 * t21;
                t6  += 38 * t22;
                t7  += 38 * t23;
                t8  += 38 * t24;
                t9  += 38 * t25;
                t10 += 38 * t26;
                t11 += 38 * t27;
                t12 += 38 * t28;
                t13 += 38 * t29;
                t14 += 38 * t30;
                // t15 left as is

                // first car
                c = 1;
                v =  t0 + c + 65535; c = Math.floor(v / 65536);  t0 = v - c * 65536;
                v =  t1 + c + 65535; c = Math.floor(v / 65536);  t1 = v - c * 65536;
                v =  t2 + c + 65535; c = Math.floor(v / 65536);  t2 = v - c * 65536;
                v =  t3 + c + 65535; c = Math.floor(v / 65536);  t3 = v - c * 65536;
                v =  t4 + c + 65535; c = Math.floor(v / 65536);  t4 = v - c * 65536;
                v =  t5 + c + 65535; c = Math.floor(v / 65536);  t5 = v - c * 65536;
                v =  t6 + c + 65535; c = Math.floor(v / 65536);  t6 = v - c * 65536;
                v =  t7 + c + 65535; c = Math.floor(v / 65536);  t7 = v - c * 65536;
                v =  t8 + c + 65535; c = Math.floor(v / 65536);  t8 = v - c * 65536;
                v =  t9 + c + 65535; c = Math.floor(v / 65536);  t9 = v - c * 65536;
                v = t10 + c + 65535; c = Math.floor(v / 65536); t10 = v - c * 65536;
                v = t11 + c + 65535; c = Math.floor(v / 65536); t11 = v - c * 65536;
                v = t12 + c + 65535; c = Math.floor(v / 65536); t12 = v - c * 65536;
                v = t13 + c + 65535; c = Math.floor(v / 65536); t13 = v - c * 65536;
                v = t14 + c + 65535; c = Math.floor(v / 65536); t14 = v - c * 65536;
                v = t15 + c + 65535; c = Math.floor(v / 65536); t15 = v - c * 65536;
                t0 += c-1 + 37 * (c-1);

                // second car
                c = 1;
                v =  t0 + c + 65535; c = Math.floor(v / 65536);  t0 = v - c * 65536;
                v =  t1 + c + 65535; c = Math.floor(v / 65536);  t1 = v - c * 65536;
                v =  t2 + c + 65535; c = Math.floor(v / 65536);  t2 = v - c * 65536;
                v =  t3 + c + 65535; c = Math.floor(v / 65536);  t3 = v - c * 65536;
                v =  t4 + c + 65535; c = Math.floor(v / 65536);  t4 = v - c * 65536;
                v =  t5 + c + 65535; c = Math.floor(v / 65536);  t5 = v - c * 65536;
                v =  t6 + c + 65535; c = Math.floor(v / 65536);  t6 = v - c * 65536;
                v =  t7 + c + 65535; c = Math.floor(v / 65536);  t7 = v - c * 65536;
                v =  t8 + c + 65535; c = Math.floor(v / 65536);  t8 = v - c * 65536;
                v =  t9 + c + 65535; c = Math.floor(v / 65536);  t9 = v - c * 65536;
                v = t10 + c + 65535; c = Math.floor(v / 65536); t10 = v - c * 65536;
                v = t11 + c + 65535; c = Math.floor(v / 65536); t11 = v - c * 65536;
                v = t12 + c + 65535; c = Math.floor(v / 65536); t12 = v - c * 65536;
                v = t13 + c + 65535; c = Math.floor(v / 65536); t13 = v - c * 65536;
                v = t14 + c + 65535; c = Math.floor(v / 65536); t14 = v - c * 65536;
                v = t15 + c + 65535; c = Math.floor(v / 65536); t15 = v - c * 65536;
                t0 += c-1 + 37 * (c-1);

                o[ 0] = t0;
                o[ 1] = t1;
                o[ 2] = t2;
                o[ 3] = t3;
                o[ 4] = t4;
                o[ 5] = t5;
                o[ 6] = t6;
                o[ 7] = t7;
                o[ 8] = t8;
                o[ 9] = t9;
                o[10] = t10;
                o[11] = t11;
                o[12] = t12;
                o[13] = t13;
                o[14] = t14;
                o[15] = t15;
            }

            function S(o, a) {
                M(o, a, a);
            }

            function inv25519(o, i) {
                var c = gf();
                var a;
                for (a = 0; a < 16; a++) c[a] = i[a];
                for (a = 253; a >= 0; a--) {
                    S(c, c);
                    if(a !== 2 && a !== 4) M(c, c, i);
                }
                for (a = 0; a < 16; a++) o[a] = c[a];
            }

            function pow2523(o, i) {
                var c = gf();
                var a;
                for (a = 0; a < 16; a++) c[a] = i[a];
                for (a = 250; a >= 0; a--) {
                    S(c, c);
                    if(a !== 1) M(c, c, i);
                }
                for (a = 0; a < 16; a++) o[a] = c[a];
            }

            function crypto_scalarmult(q, n, p) {
                var z = new Uint8Array(32);
                var x = new Float64Array(80), r, i;
                var a = gf(), b = gf(), c = gf(),
                    d = gf(), e = gf(), f = gf();
                for (i = 0; i < 31; i++) z[i] = n[i];
                z[31]=(n[31]&127)|64;
                z[0]&=248;
                unpack25519(x,p);
                for (i = 0; i < 16; i++) {
                    b[i]=x[i];
                    d[i]=a[i]=c[i]=0;
                }
                a[0]=d[0]=1;
                for (i=254; i>=0; --i) {
                    r=(z[i>>>3]>>>(i&7))&1;
                    sel25519(a,b,r);
                    sel25519(c,d,r);
                    A(e,a,c);
                    Z(a,a,c);
                    A(c,b,d);
                    Z(b,b,d);
                    S(d,e);
                    S(f,a);
                    M(a,c,a);
                    M(c,b,e);
                    A(e,a,c);
                    Z(a,a,c);
                    S(b,a);
                    Z(c,d,f);
                    M(a,c,_121665);
                    A(a,a,d);
                    M(c,c,a);
                    M(a,d,f);
                    M(d,b,x);
                    S(b,e);
                    sel25519(a,b,r);
                    sel25519(c,d,r);
                }
                for (i = 0; i < 16; i++) {
                    x[i+16]=a[i];
                    x[i+32]=c[i];
                    x[i+48]=b[i];
                    x[i+64]=d[i];
                }
                var x32 = x.subarray(32);
                var x16 = x.subarray(16);
                inv25519(x32,x32);
                M(x16,x16,x32);
                pack25519(q,x16);
                return 0;
            }

            function crypto_scalarmult_base(q, n) {
                return crypto_scalarmult(q, n, _9);
            }

            function crypto_box_keypair(y, x) {
                randombytes(x, 32);
                return crypto_scalarmult_base(y, x);
            }

            function crypto_box_beforenm(k, y, x) {
                var s = new Uint8Array(32);
                crypto_scalarmult(s, x, y);
                return crypto_core_hsalsa20(k, _0, s, sigma);
            }

            var crypto_box_afternm = crypto_secretbox;
            var crypto_box_open_afternm = crypto_secretbox_open;

            function crypto_box(c, m, d, n, y, x) {
                var k = new Uint8Array(32);
                crypto_box_beforenm(k, y, x);
                return crypto_box_afternm(c, m, d, n, k);
            }

            function crypto_box_open(m, c, d, n, y, x) {
                var k = new Uint8Array(32);
                crypto_box_beforenm(k, y, x);
                return crypto_box_open_afternm(m, c, d, n, k);
            }

            var K = [
                0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd,
                0xb5c0fbcf, 0xec4d3b2f, 0xe9b5dba5, 0x8189dbbc,
                0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019,
                0x923f82a4, 0xaf194f9b, 0xab1c5ed5, 0xda6d8118,
                0xd807aa98, 0xa3030242, 0x12835b01, 0x45706fbe,
                0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2,
                0x72be5d74, 0xf27b896f, 0x80deb1fe, 0x3b1696b1,
                0x9bdc06a7, 0x25c71235, 0xc19bf174, 0xcf692694,
                0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3,
                0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc, 0x77ac9c65,
                0x2de92c6f, 0x592b0275, 0x4a7484aa, 0x6ea6e483,
                0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5,
                0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210,
                0xb00327c8, 0x98fb213f, 0xbf597fc7, 0xbeef0ee4,
                0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725,
                0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70,
                0x27b70a85, 0x46d22ffc, 0x2e1b2138, 0x5c26c926,
                0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df,
                0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8,
                0x81c2c92e, 0x47edaee6, 0x92722c85, 0x1482353b,
                0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001,
                0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30,
                0xd192e819, 0xd6ef5218, 0xd6990624, 0x5565a910,
                0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8,
                0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53,
                0x2748774c, 0xdf8eeb99, 0x34b0bcb5, 0xe19b48a8,
                0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb,
                0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3,
                0x748f82ee, 0x5defb2fc, 0x78a5636f, 0x43172f60,
                0x84c87814, 0xa1f0ab72, 0x8cc70208, 0x1a6439ec,
                0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9,
                0xbef9a3f7, 0xb2c67915, 0xc67178f2, 0xe372532b,
                0xca273ece, 0xea26619c, 0xd186b8c7, 0x21c0c207,
                0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178,
                0x06f067aa, 0x72176fba, 0x0a637dc5, 0xa2c898a6,
                0x113f9804, 0xbef90dae, 0x1b710b35, 0x131c471b,
                0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493,
                0x3c9ebe0a, 0x15c9bebc, 0x431d67c4, 0x9c100d4c,
                0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a,
                0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817
            ];

            function crypto_hashblocks_hl(hh, hl, m, n) {
                var wh = new Int32Array(16), wl = new Int32Array(16),
                    bh0, bh1, bh2, bh3, bh4, bh5, bh6, bh7,
                    bl0, bl1, bl2, bl3, bl4, bl5, bl6, bl7,
                    th, tl, i, j, h, l, a, b, c, d;

                var ah0 = hh[0],
                    ah1 = hh[1],
                    ah2 = hh[2],
                    ah3 = hh[3],
                    ah4 = hh[4],
                    ah5 = hh[5],
                    ah6 = hh[6],
                    ah7 = hh[7],

                    al0 = hl[0],
                    al1 = hl[1],
                    al2 = hl[2],
                    al3 = hl[3],
                    al4 = hl[4],
                    al5 = hl[5],
                    al6 = hl[6],
                    al7 = hl[7];

                var pos = 0;
                while (n >= 128) {
                    for (i = 0; i < 16; i++) {
                        j = 8 * i + pos;
                        wh[i] = (m[j+0] << 24) | (m[j+1] << 16) | (m[j+2] << 8) | m[j+3];
                        wl[i] = (m[j+4] << 24) | (m[j+5] << 16) | (m[j+6] << 8) | m[j+7];
                    }
                    for (i = 0; i < 80; i++) {
                        bh0 = ah0;
                        bh1 = ah1;
                        bh2 = ah2;
                        bh3 = ah3;
                        bh4 = ah4;
                        bh5 = ah5;
                        bh6 = ah6;
                        bh7 = ah7;

                        bl0 = al0;
                        bl1 = al1;
                        bl2 = al2;
                        bl3 = al3;
                        bl4 = al4;
                        bl5 = al5;
                        bl6 = al6;
                        bl7 = al7;

                        // add
                        h = ah7;
                        l = al7;

                        a = l & 0xffff; b = l >>> 16;
                        c = h & 0xffff; d = h >>> 16;

                        // Sigma1
                        h = ((ah4 >>> 14) | (al4 << (32-14))) ^ ((ah4 >>> 18) | (al4 << (32-18))) ^ ((al4 >>> (41-32)) | (ah4 << (32-(41-32))));
                        l = ((al4 >>> 14) | (ah4 << (32-14))) ^ ((al4 >>> 18) | (ah4 << (32-18))) ^ ((ah4 >>> (41-32)) | (al4 << (32-(41-32))));

                        a += l & 0xffff; b += l >>> 16;
                        c += h & 0xffff; d += h >>> 16;

                        // Ch
                        h = (ah4 & ah5) ^ (~ah4 & ah6);
                        l = (al4 & al5) ^ (~al4 & al6);

                        a += l & 0xffff; b += l >>> 16;
                        c += h & 0xffff; d += h >>> 16;

                        // K
                        h = K[i*2];
                        l = K[i*2+1];

                        a += l & 0xffff; b += l >>> 16;
                        c += h & 0xffff; d += h >>> 16;

                        // w
                        h = wh[i%16];
                        l = wl[i%16];

                        a += l & 0xffff; b += l >>> 16;
                        c += h & 0xffff; d += h >>> 16;

                        b += a >>> 16;
                        c += b >>> 16;
                        d += c >>> 16;

                        th = c & 0xffff | d << 16;
                        tl = a & 0xffff | b << 16;

                        // add
                        h = th;
                        l = tl;

                        a = l & 0xffff; b = l >>> 16;
                        c = h & 0xffff; d = h >>> 16;

                        // Sigma0
                        h = ((ah0 >>> 28) | (al0 << (32-28))) ^ ((al0 >>> (34-32)) | (ah0 << (32-(34-32)))) ^ ((al0 >>> (39-32)) | (ah0 << (32-(39-32))));
                        l = ((al0 >>> 28) | (ah0 << (32-28))) ^ ((ah0 >>> (34-32)) | (al0 << (32-(34-32)))) ^ ((ah0 >>> (39-32)) | (al0 << (32-(39-32))));

                        a += l & 0xffff; b += l >>> 16;
                        c += h & 0xffff; d += h >>> 16;

                        // Maj
                        h = (ah0 & ah1) ^ (ah0 & ah2) ^ (ah1 & ah2);
                        l = (al0 & al1) ^ (al0 & al2) ^ (al1 & al2);

                        a += l & 0xffff; b += l >>> 16;
                        c += h & 0xffff; d += h >>> 16;

                        b += a >>> 16;
                        c += b >>> 16;
                        d += c >>> 16;

                        bh7 = (c & 0xffff) | (d << 16);
                        bl7 = (a & 0xffff) | (b << 16);

                        // add
                        h = bh3;
                        l = bl3;

                        a = l & 0xffff; b = l >>> 16;
                        c = h & 0xffff; d = h >>> 16;

                        h = th;
                        l = tl;

                        a += l & 0xffff; b += l >>> 16;
                        c += h & 0xffff; d += h >>> 16;

                        b += a >>> 16;
                        c += b >>> 16;
                        d += c >>> 16;

                        bh3 = (c & 0xffff) | (d << 16);
                        bl3 = (a & 0xffff) | (b << 16);

                        ah1 = bh0;
                        ah2 = bh1;
                        ah3 = bh2;
                        ah4 = bh3;
                        ah5 = bh4;
                        ah6 = bh5;
                        ah7 = bh6;
                        ah0 = bh7;

                        al1 = bl0;
                        al2 = bl1;
                        al3 = bl2;
                        al4 = bl3;
                        al5 = bl4;
                        al6 = bl5;
                        al7 = bl6;
                        al0 = bl7;

                        if (i%16 === 15) {
                            for (j = 0; j < 16; j++) {
                                // add
                                h = wh[j];
                                l = wl[j];

                                a = l & 0xffff; b = l >>> 16;
                                c = h & 0xffff; d = h >>> 16;

                                h = wh[(j+9)%16];
                                l = wl[(j+9)%16];

                                a += l & 0xffff; b += l >>> 16;
                                c += h & 0xffff; d += h >>> 16;

                                // sigma0
                                th = wh[(j+1)%16];
                                tl = wl[(j+1)%16];
                                h = ((th >>> 1) | (tl << (32-1))) ^ ((th >>> 8) | (tl << (32-8))) ^ (th >>> 7);
                                l = ((tl >>> 1) | (th << (32-1))) ^ ((tl >>> 8) | (th << (32-8))) ^ ((tl >>> 7) | (th << (32-7)));

                                a += l & 0xffff; b += l >>> 16;
                                c += h & 0xffff; d += h >>> 16;

                                // sigma1
                                th = wh[(j+14)%16];
                                tl = wl[(j+14)%16];
                                h = ((th >>> 19) | (tl << (32-19))) ^ ((tl >>> (61-32)) | (th << (32-(61-32)))) ^ (th >>> 6);
                                l = ((tl >>> 19) | (th << (32-19))) ^ ((th >>> (61-32)) | (tl << (32-(61-32)))) ^ ((tl >>> 6) | (th << (32-6)));

                                a += l & 0xffff; b += l >>> 16;
                                c += h & 0xffff; d += h >>> 16;

                                b += a >>> 16;
                                c += b >>> 16;
                                d += c >>> 16;

                                wh[j] = (c & 0xffff) | (d << 16);
                                wl[j] = (a & 0xffff) | (b << 16);
                            }
                        }
                    }

                    // add
                    h = ah0;
                    l = al0;

                    a = l & 0xffff; b = l >>> 16;
                    c = h & 0xffff; d = h >>> 16;

                    h = hh[0];
                    l = hl[0];

                    a += l & 0xffff; b += l >>> 16;
                    c += h & 0xffff; d += h >>> 16;

                    b += a >>> 16;
                    c += b >>> 16;
                    d += c >>> 16;

                    hh[0] = ah0 = (c & 0xffff) | (d << 16);
                    hl[0] = al0 = (a & 0xffff) | (b << 16);

                    h = ah1;
                    l = al1;

                    a = l & 0xffff; b = l >>> 16;
                    c = h & 0xffff; d = h >>> 16;

                    h = hh[1];
                    l = hl[1];

                    a += l & 0xffff; b += l >>> 16;
                    c += h & 0xffff; d += h >>> 16;

                    b += a >>> 16;
                    c += b >>> 16;
                    d += c >>> 16;

                    hh[1] = ah1 = (c & 0xffff) | (d << 16);
                    hl[1] = al1 = (a & 0xffff) | (b << 16);

                    h = ah2;
                    l = al2;

                    a = l & 0xffff; b = l >>> 16;
                    c = h & 0xffff; d = h >>> 16;

                    h = hh[2];
                    l = hl[2];

                    a += l & 0xffff; b += l >>> 16;
                    c += h & 0xffff; d += h >>> 16;

                    b += a >>> 16;
                    c += b >>> 16;
                    d += c >>> 16;

                    hh[2] = ah2 = (c & 0xffff) | (d << 16);
                    hl[2] = al2 = (a & 0xffff) | (b << 16);

                    h = ah3;
                    l = al3;

                    a = l & 0xffff; b = l >>> 16;
                    c = h & 0xffff; d = h >>> 16;

                    h = hh[3];
                    l = hl[3];

                    a += l & 0xffff; b += l >>> 16;
                    c += h & 0xffff; d += h >>> 16;

                    b += a >>> 16;
                    c += b >>> 16;
                    d += c >>> 16;

                    hh[3] = ah3 = (c & 0xffff) | (d << 16);
                    hl[3] = al3 = (a & 0xffff) | (b << 16);

                    h = ah4;
                    l = al4;

                    a = l & 0xffff; b = l >>> 16;
                    c = h & 0xffff; d = h >>> 16;

                    h = hh[4];
                    l = hl[4];

                    a += l & 0xffff; b += l >>> 16;
                    c += h & 0xffff; d += h >>> 16;

                    b += a >>> 16;
                    c += b >>> 16;
                    d += c >>> 16;

                    hh[4] = ah4 = (c & 0xffff) | (d << 16);
                    hl[4] = al4 = (a & 0xffff) | (b << 16);

                    h = ah5;
                    l = al5;

                    a = l & 0xffff; b = l >>> 16;
                    c = h & 0xffff; d = h >>> 16;

                    h = hh[5];
                    l = hl[5];

                    a += l & 0xffff; b += l >>> 16;
                    c += h & 0xffff; d += h >>> 16;

                    b += a >>> 16;
                    c += b >>> 16;
                    d += c >>> 16;

                    hh[5] = ah5 = (c & 0xffff) | (d << 16);
                    hl[5] = al5 = (a & 0xffff) | (b << 16);

                    h = ah6;
                    l = al6;

                    a = l & 0xffff; b = l >>> 16;
                    c = h & 0xffff; d = h >>> 16;

                    h = hh[6];
                    l = hl[6];

                    a += l & 0xffff; b += l >>> 16;
                    c += h & 0xffff; d += h >>> 16;

                    b += a >>> 16;
                    c += b >>> 16;
                    d += c >>> 16;

                    hh[6] = ah6 = (c & 0xffff) | (d << 16);
                    hl[6] = al6 = (a & 0xffff) | (b << 16);

                    h = ah7;
                    l = al7;

                    a = l & 0xffff; b = l >>> 16;
                    c = h & 0xffff; d = h >>> 16;

                    h = hh[7];
                    l = hl[7];

                    a += l & 0xffff; b += l >>> 16;
                    c += h & 0xffff; d += h >>> 16;

                    b += a >>> 16;
                    c += b >>> 16;
                    d += c >>> 16;

                    hh[7] = ah7 = (c & 0xffff) | (d << 16);
                    hl[7] = al7 = (a & 0xffff) | (b << 16);

                    pos += 128;
                    n -= 128;
                }

                return n;
            }

            function crypto_hash(out, m, n) {
                var hh = new Int32Array(8),
                    hl = new Int32Array(8),
                    x = new Uint8Array(256),
                    i, b = n;

                hh[0] = 0x6a09e667;
                hh[1] = 0xbb67ae85;
                hh[2] = 0x3c6ef372;
                hh[3] = 0xa54ff53a;
                hh[4] = 0x510e527f;
                hh[5] = 0x9b05688c;
                hh[6] = 0x1f83d9ab;
                hh[7] = 0x5be0cd19;

                hl[0] = 0xf3bcc908;
                hl[1] = 0x84caa73b;
                hl[2] = 0xfe94f82b;
                hl[3] = 0x5f1d36f1;
                hl[4] = 0xade682d1;
                hl[5] = 0x2b3e6c1f;
                hl[6] = 0xfb41bd6b;
                hl[7] = 0x137e2179;

                crypto_hashblocks_hl(hh, hl, m, n);
                n %= 128;

                for (i = 0; i < n; i++) x[i] = m[b-n+i];
                x[n] = 128;

                n = 256-128*(n<112?1:0);
                x[n-9] = 0;
                ts64(x, n-8,  (b / 0x20000000) | 0, b << 3);
                crypto_hashblocks_hl(hh, hl, x, n);

                for (i = 0; i < 8; i++) ts64(out, 8*i, hh[i], hl[i]);

                return 0;
            }

            function add(p, q) {
                var a = gf(), b = gf(), c = gf(),
                    d = gf(), e = gf(), f = gf(),
                    g = gf(), h = gf(), t = gf();

                Z(a, p[1], p[0]);
                Z(t, q[1], q[0]);
                M(a, a, t);
                A(b, p[0], p[1]);
                A(t, q[0], q[1]);
                M(b, b, t);
                M(c, p[3], q[3]);
                M(c, c, D2);
                M(d, p[2], q[2]);
                A(d, d, d);
                Z(e, b, a);
                Z(f, d, c);
                A(g, d, c);
                A(h, b, a);

                M(p[0], e, f);
                M(p[1], h, g);
                M(p[2], g, f);
                M(p[3], e, h);
            }

            function cswap(p, q, b) {
                var i;
                for (i = 0; i < 4; i++) {
                    sel25519(p[i], q[i], b);
                }
            }

            function pack(r, p) {
                var tx = gf(), ty = gf(), zi = gf();
                inv25519(zi, p[2]);
                M(tx, p[0], zi);
                M(ty, p[1], zi);
                pack25519(r, ty);
                r[31] ^= par25519(tx) << 7;
            }

            function scalarmult(p, q, s) {
                var b, i;
                set25519(p[0], gf0);
                set25519(p[1], gf1);
                set25519(p[2], gf1);
                set25519(p[3], gf0);
                for (i = 255; i >= 0; --i) {
                    b = (s[(i/8)|0] >> (i&7)) & 1;
                    cswap(p, q, b);
                    add(q, p);
                    add(p, p);
                    cswap(p, q, b);
                }
            }

            function scalarbase(p, s) {
                var q = [gf(), gf(), gf(), gf()];
                set25519(q[0], X);
                set25519(q[1], Y);
                set25519(q[2], gf1);
                M(q[3], X, Y);
                scalarmult(p, q, s);
            }

            function crypto_sign_keypair(pk, sk, seeded) {
                var d = new Uint8Array(64);
                var p = [gf(), gf(), gf(), gf()];
                var i;

                if (!seeded) randombytes(sk, 32);
                crypto_hash(d, sk, 32);
                d[0] &= 248;
                d[31] &= 127;
                d[31] |= 64;

                scalarbase(p, d);
                pack(pk, p);

                for (i = 0; i < 32; i++) sk[i+32] = pk[i];
                return 0;
            }

            var L = new Float64Array([0xed, 0xd3, 0xf5, 0x5c, 0x1a, 0x63, 0x12, 0x58, 0xd6, 0x9c, 0xf7, 0xa2, 0xde, 0xf9, 0xde, 0x14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x10]);

            function modL(r, x) {
                var carry, i, j, k;
                for (i = 63; i >= 32; --i) {
                    carry = 0;
                    for (j = i - 32, k = i - 12; j < k; ++j) {
                        x[j] += carry - 16 * x[i] * L[j - (i - 32)];
                        carry = (x[j] + 128) >> 8;
                        x[j] -= carry * 256;
                    }
                    x[j] += carry;
                    x[i] = 0;
                }
                carry = 0;
                for (j = 0; j < 32; j++) {
                    x[j] += carry - (x[31] >> 4) * L[j];
                    carry = x[j] >> 8;
                    x[j] &= 255;
                }
                for (j = 0; j < 32; j++) x[j] -= carry * L[j];
                for (i = 0; i < 32; i++) {
                    x[i+1] += x[i] >> 8;
                    r[i] = x[i] & 255;
                }
            }

            function reduce(r) {
                var x = new Float64Array(64), i;
                for (i = 0; i < 64; i++) x[i] = r[i];
                for (i = 0; i < 64; i++) r[i] = 0;
                modL(r, x);
            }

// Note: difference from C - smlen returned, not passed as argument.
            function crypto_sign(sm, m, n, sk) {
                var d = new Uint8Array(64), h = new Uint8Array(64), r = new Uint8Array(64);
                var i, j, x = new Float64Array(64);
                var p = [gf(), gf(), gf(), gf()];

                crypto_hash(d, sk, 32);
                d[0] &= 248;
                d[31] &= 127;
                d[31] |= 64;

                var smlen = n + 64;
                for (i = 0; i < n; i++) sm[64 + i] = m[i];
                for (i = 0; i < 32; i++) sm[32 + i] = d[32 + i];

                crypto_hash(r, sm.subarray(32), n+32);
                reduce(r);
                scalarbase(p, r);
                pack(sm, p);

                for (i = 32; i < 64; i++) sm[i] = sk[i];
                crypto_hash(h, sm, n + 64);
                reduce(h);

                for (i = 0; i < 64; i++) x[i] = 0;
                for (i = 0; i < 32; i++) x[i] = r[i];
                for (i = 0; i < 32; i++) {
                    for (j = 0; j < 32; j++) {
                        x[i+j] += h[i] * d[j];
                    }
                }

                modL(sm.subarray(32), x);
                return smlen;
            }

            function unpackneg(r, p) {
                var t = gf(), chk = gf(), num = gf(),
                    den = gf(), den2 = gf(), den4 = gf(),
                    den6 = gf();

                set25519(r[2], gf1);
                unpack25519(r[1], p);
                S(num, r[1]);
                M(den, num, D);
                Z(num, num, r[2]);
                A(den, r[2], den);

                S(den2, den);
                S(den4, den2);
                M(den6, den4, den2);
                M(t, den6, num);
                M(t, t, den);

                pow2523(t, t);
                M(t, t, num);
                M(t, t, den);
                M(t, t, den);
                M(r[0], t, den);

                S(chk, r[0]);
                M(chk, chk, den);
                if (neq25519(chk, num)) M(r[0], r[0], I);

                S(chk, r[0]);
                M(chk, chk, den);
                if (neq25519(chk, num)) return -1;

                if (par25519(r[0]) === (p[31]>>7)) Z(r[0], gf0, r[0]);

                M(r[3], r[0], r[1]);
                return 0;
            }

            function crypto_sign_open(m, sm, n, pk) {
                var i, mlen;
                var t = new Uint8Array(32), h = new Uint8Array(64);
                var p = [gf(), gf(), gf(), gf()],
                    q = [gf(), gf(), gf(), gf()];

                mlen = -1;
                if (n < 64) return -1;

                if (unpackneg(q, pk)) return -1;

                for (i = 0; i < n; i++) m[i] = sm[i];
                for (i = 0; i < 32; i++) m[i+32] = pk[i];
                crypto_hash(h, m, n);
                reduce(h);
                scalarmult(p, q, h);

                scalarbase(q, sm.subarray(32));
                add(p, q);
                pack(t, p);

                n -= 64;
                if (crypto_verify_32(sm, 0, t, 0)) {
                    for (i = 0; i < n; i++) m[i] = 0;
                    return -1;
                }

                for (i = 0; i < n; i++) m[i] = sm[i + 64];
                mlen = n;
                return mlen;
            }

            var crypto_secretbox_KEYBYTES = 32,
                crypto_secretbox_NONCEBYTES = 24,
                crypto_secretbox_ZEROBYTES = 32,
                crypto_secretbox_BOXZEROBYTES = 16,
                crypto_scalarmult_BYTES = 32,
                crypto_scalarmult_SCALARBYTES = 32,
                crypto_box_PUBLICKEYBYTES = 32,
                crypto_box_SECRETKEYBYTES = 32,
                crypto_box_BEFORENMBYTES = 32,
                crypto_box_NONCEBYTES = crypto_secretbox_NONCEBYTES,
                crypto_box_ZEROBYTES = crypto_secretbox_ZEROBYTES,
                crypto_box_BOXZEROBYTES = crypto_secretbox_BOXZEROBYTES,
                crypto_sign_BYTES = 64,
                crypto_sign_PUBLICKEYBYTES = 32,
                crypto_sign_SECRETKEYBYTES = 64,
                crypto_sign_SEEDBYTES = 32,
                crypto_hash_BYTES = 64;

            nacl.lowlevel = {
                crypto_core_hsalsa20: crypto_core_hsalsa20,
                crypto_stream_xor: crypto_stream_xor,
                crypto_stream: crypto_stream,
                crypto_stream_salsa20_xor: crypto_stream_salsa20_xor,
                crypto_stream_salsa20: crypto_stream_salsa20,
                crypto_onetimeauth: crypto_onetimeauth,
                crypto_onetimeauth_verify: crypto_onetimeauth_verify,
                crypto_verify_16: crypto_verify_16,
                crypto_verify_32: crypto_verify_32,
                crypto_secretbox: crypto_secretbox,
                crypto_secretbox_open: crypto_secretbox_open,
                crypto_scalarmult: crypto_scalarmult,
                crypto_scalarmult_base: crypto_scalarmult_base,
                crypto_box_beforenm: crypto_box_beforenm,
                crypto_box_afternm: crypto_box_afternm,
                crypto_box: crypto_box,
                crypto_box_open: crypto_box_open,
                crypto_box_keypair: crypto_box_keypair,
                crypto_hash: crypto_hash,
                crypto_sign: crypto_sign,
                crypto_sign_keypair: crypto_sign_keypair,
                crypto_sign_open: crypto_sign_open,

                crypto_secretbox_KEYBYTES: crypto_secretbox_KEYBYTES,
                crypto_secretbox_NONCEBYTES: crypto_secretbox_NONCEBYTES,
                crypto_secretbox_ZEROBYTES: crypto_secretbox_ZEROBYTES,
                crypto_secretbox_BOXZEROBYTES: crypto_secretbox_BOXZEROBYTES,
                crypto_scalarmult_BYTES: crypto_scalarmult_BYTES,
                crypto_scalarmult_SCALARBYTES: crypto_scalarmult_SCALARBYTES,
                crypto_box_PUBLICKEYBYTES: crypto_box_PUBLICKEYBYTES,
                crypto_box_SECRETKEYBYTES: crypto_box_SECRETKEYBYTES,
                crypto_box_BEFORENMBYTES: crypto_box_BEFORENMBYTES,
                crypto_box_NONCEBYTES: crypto_box_NONCEBYTES,
                crypto_box_ZEROBYTES: crypto_box_ZEROBYTES,
                crypto_box_BOXZEROBYTES: crypto_box_BOXZEROBYTES,
                crypto_sign_BYTES: crypto_sign_BYTES,
                crypto_sign_PUBLICKEYBYTES: crypto_sign_PUBLICKEYBYTES,
                crypto_sign_SECRETKEYBYTES: crypto_sign_SECRETKEYBYTES,
                crypto_sign_SEEDBYTES: crypto_sign_SEEDBYTES,
                crypto_hash_BYTES: crypto_hash_BYTES
            };

            /* High-level API */

            function checkLengths(k, n) {
                if (k.length !== crypto_secretbox_KEYBYTES) throw new Error('bad key size');
                if (n.length !== crypto_secretbox_NONCEBYTES) throw new Error('bad nonce size');
            }

            function checkBoxLengths(pk, sk) {
                if (pk.length !== crypto_box_PUBLICKEYBYTES) throw new Error('bad public key size');
                if (sk.length !== crypto_box_SECRETKEYBYTES) throw new Error('bad secret key size');
            }

            function checkArrayTypes() {
                var t, i;
                for (i = 0; i < arguments.length; i++) {
                    if ((t = Object.prototype.toString.call(arguments[i])) !== '[object Uint8Array]')
                        throw new TypeError('unexpected type ' + t + ', use Uint8Array');
                }
            }

            function cleanup(arr) {
                for (var i = 0; i < arr.length; i++) arr[i] = 0;
            }

            nacl.util = {};

            nacl.util.decodeUTF8 = function(s) {
                var i, d = unescape(encodeURIComponent(s)), b = new Uint8Array(d.length);
                for (i = 0; i < d.length; i++) b[i] = d.charCodeAt(i);
                return b;
            };

            nacl.util.encodeUTF8 = function(arr) {
                var i, s = [];
                for (i = 0; i < arr.length; i++) s.push(String.fromCharCode(arr[i]));
                return decodeURIComponent(escape(s.join('')));
            };

            nacl.util.encodeBase64 = function(arr) {
                if (typeof btoa === 'undefined') {
                    return (new Buffer(arr)).toString('base64');
                } else {
                    var i, s = [], len = arr.length;
                    for (i = 0; i < len; i++) s.push(String.fromCharCode(arr[i]));
                    return btoa(s.join(''));
                }
            };

            nacl.util.decodeBase64 = function(s) {
                if (typeof atob === 'undefined') {
                    return new Uint8Array(Array.prototype.slice.call(new Buffer(s, 'base64'), 0));
                } else {
                    var i, d = atob(s), b = new Uint8Array(d.length);
                    for (i = 0; i < d.length; i++) b[i] = d.charCodeAt(i);
                    return b;
                }
            };

            nacl.randomBytes = function(n) {
                var b = new Uint8Array(n);
                randombytes(b, n);
                return b;
            };

            nacl.secretbox = function(msg, nonce, key) {
                checkArrayTypes(msg, nonce, key);
                checkLengths(key, nonce);
                var m = new Uint8Array(crypto_secretbox_ZEROBYTES + msg.length);
                var c = new Uint8Array(m.length);
                for (var i = 0; i < msg.length; i++) m[i+crypto_secretbox_ZEROBYTES] = msg[i];
                crypto_secretbox(c, m, m.length, nonce, key);
                return c.subarray(crypto_secretbox_BOXZEROBYTES);
            };

            nacl.secretbox.open = function(box, nonce, key) {
                checkArrayTypes(box, nonce, key);
                checkLengths(key, nonce);
                var c = new Uint8Array(crypto_secretbox_BOXZEROBYTES + box.length);
                var m = new Uint8Array(c.length);
                for (var i = 0; i < box.length; i++) c[i+crypto_secretbox_BOXZEROBYTES] = box[i];
                if (c.length < 32) return false;
                if (crypto_secretbox_open(m, c, c.length, nonce, key) !== 0) return false;
                return m.subarray(crypto_secretbox_ZEROBYTES);
            };

            nacl.secretbox.keyLength = crypto_secretbox_KEYBYTES;
            nacl.secretbox.nonceLength = crypto_secretbox_NONCEBYTES;
            nacl.secretbox.overheadLength = crypto_secretbox_BOXZEROBYTES;

            nacl.scalarMult = function(n, p) {
                checkArrayTypes(n, p);
                if (n.length !== crypto_scalarmult_SCALARBYTES) throw new Error('bad n size');
                if (p.length !== crypto_scalarmult_BYTES) throw new Error('bad p size');
                var q = new Uint8Array(crypto_scalarmult_BYTES);
                crypto_scalarmult(q, n, p);
                return q;
            };

            nacl.scalarMult.base = function(n) {
                checkArrayTypes(n);
                if (n.length !== crypto_scalarmult_SCALARBYTES) throw new Error('bad n size');
                var q = new Uint8Array(crypto_scalarmult_BYTES);
                crypto_scalarmult_base(q, n);
                return q;
            };

            nacl.scalarMult.scalarLength = crypto_scalarmult_SCALARBYTES;
            nacl.scalarMult.groupElementLength = crypto_scalarmult_BYTES;

            nacl.box = function(msg, nonce, publicKey, secretKey) {
                var k = nacl.box.before(publicKey, secretKey);
                return nacl.secretbox(msg, nonce, k);
            };

            nacl.box.before = function(publicKey, secretKey) {
                checkArrayTypes(publicKey, secretKey);
                checkBoxLengths(publicKey, secretKey);
                var k = new Uint8Array(crypto_box_BEFORENMBYTES);
                crypto_box_beforenm(k, publicKey, secretKey);
                return k;
            };

            nacl.box.after = nacl.secretbox;

            nacl.box.open = function(msg, nonce, publicKey, secretKey) {
                var k = nacl.box.before(publicKey, secretKey);
                return nacl.secretbox.open(msg, nonce, k);
            };

            nacl.box.open.after = nacl.secretbox.open;

            nacl.box.keyPair = function() {
                var pk = new Uint8Array(crypto_box_PUBLICKEYBYTES);
                var sk = new Uint8Array(crypto_box_SECRETKEYBYTES);
                crypto_box_keypair(pk, sk);
                return {publicKey: pk, secretKey: sk};
            };

            nacl.box.keyPair.fromSecretKey = function(secretKey) {
                checkArrayTypes(secretKey);
                if (secretKey.length !== crypto_box_SECRETKEYBYTES)
                    throw new Error('bad secret key size');
                var pk = new Uint8Array(crypto_box_PUBLICKEYBYTES);
                crypto_scalarmult_base(pk, secretKey);
                return {publicKey: pk, secretKey: new Uint8Array(secretKey)};
            };

            nacl.box.publicKeyLength = crypto_box_PUBLICKEYBYTES;
            nacl.box.secretKeyLength = crypto_box_SECRETKEYBYTES;
            nacl.box.sharedKeyLength = crypto_box_BEFORENMBYTES;
            nacl.box.nonceLength = crypto_box_NONCEBYTES;
            nacl.box.overheadLength = nacl.secretbox.overheadLength;

            nacl.sign = function(msg, secretKey) {
                checkArrayTypes(msg, secretKey);
                if (secretKey.length !== crypto_sign_SECRETKEYBYTES)
                    throw new Error('bad secret key size');
                var signedMsg = new Uint8Array(crypto_sign_BYTES+msg.length);
                crypto_sign(signedMsg, msg, msg.length, secretKey);
                return signedMsg;
            };

            nacl.sign.open = function(signedMsg, publicKey) {
                if (arguments.length !== 2)
                    throw new Error('nacl.sign.open accepts 2 arguments; did you mean to use nacl.sign.detached.verify?');
                checkArrayTypes(signedMsg, publicKey);
                if (publicKey.length !== crypto_sign_PUBLICKEYBYTES)
                    throw new Error('bad public key size');
                var tmp = new Uint8Array(signedMsg.length);
                var mlen = crypto_sign_open(tmp, signedMsg, signedMsg.length, publicKey);
                if (mlen < 0) return null;
                var m = new Uint8Array(mlen);
                for (var i = 0; i < m.length; i++) m[i] = tmp[i];
                return m;
            };

            nacl.sign.detached = function(msg, secretKey) {
                var signedMsg = nacl.sign(msg, secretKey);
                var sig = new Uint8Array(crypto_sign_BYTES);
                for (var i = 0; i < sig.length; i++) sig[i] = signedMsg[i];
                return sig;
            };

            nacl.sign.detached.verify = function(msg, sig, publicKey) {
                checkArrayTypes(msg, sig, publicKey);
                if (sig.length !== crypto_sign_BYTES)
                    throw new Error('bad signature size');
                if (publicKey.length !== crypto_sign_PUBLICKEYBYTES)
                    throw new Error('bad public key size');
                var sm = new Uint8Array(crypto_sign_BYTES + msg.length);
                var m = new Uint8Array(crypto_sign_BYTES + msg.length);
                var i;
                for (i = 0; i < crypto_sign_BYTES; i++) sm[i] = sig[i];
                for (i = 0; i < msg.length; i++) sm[i+crypto_sign_BYTES] = msg[i];
                return (crypto_sign_open(m, sm, sm.length, publicKey) >= 0);
            };

            nacl.sign.keyPair = function() {
                var pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
                var sk = new Uint8Array(crypto_sign_SECRETKEYBYTES);
                crypto_sign_keypair(pk, sk);
                return {publicKey: pk, secretKey: sk};
            };

            nacl.sign.keyPair.fromSecretKey = function(secretKey) {
                checkArrayTypes(secretKey);
                if (secretKey.length !== crypto_sign_SECRETKEYBYTES)
                    throw new Error('bad secret key size');
                var pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
                for (var i = 0; i < pk.length; i++) pk[i] = secretKey[32+i];
                return {publicKey: pk, secretKey: new Uint8Array(secretKey)};
            };

            nacl.sign.keyPair.fromSeed = function(seed) {
                checkArrayTypes(seed);
                if (seed.length !== crypto_sign_SEEDBYTES)
                    throw new Error('bad seed size');
                var pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
                var sk = new Uint8Array(crypto_sign_SECRETKEYBYTES);
                for (var i = 0; i < 32; i++) sk[i] = seed[i];
                crypto_sign_keypair(pk, sk, true);
                return {publicKey: pk, secretKey: sk};
            };

            nacl.sign.publicKeyLength = crypto_sign_PUBLICKEYBYTES;
            nacl.sign.secretKeyLength = crypto_sign_SECRETKEYBYTES;
            nacl.sign.seedLength = crypto_sign_SEEDBYTES;
            nacl.sign.signatureLength = crypto_sign_BYTES;

            nacl.hash = function(msg) {
                checkArrayTypes(msg);
                var h = new Uint8Array(crypto_hash_BYTES);
                crypto_hash(h, msg, msg.length);
                return h;
            };

            nacl.hash.hashLength = crypto_hash_BYTES;

            nacl.verify = function(x, y) {
                checkArrayTypes(x, y);
                // Zero length arguments are considered not equal.
                if (x.length === 0 || y.length === 0) return false;
                if (x.length !== y.length) return false;
                return (vn(x, 0, y, 0, x.length) === 0) ? true : false;
            };

            nacl.setPRNG = function(fn) {
                randombytes = fn;
            };

            (function() {
                // Initialize PRNG if environment provides CSPRNG.
                // If not, methods calling randombytes will throw.
                var crypto;
                if (typeof window !== 'undefined') {
                    // Browser.
                    if (window.crypto && window.crypto.getRandomValues) {
                        crypto = window.crypto; // Standard
                    } else if (window.msCrypto && window.msCrypto.getRandomValues) {
                        crypto = window.msCrypto; // Internet Explorer 11+
                    }
                    if (crypto) {
                        nacl.setPRNG(function(x, n) {
                            var i, v = new Uint8Array(n);
                            crypto.getRandomValues(v);
                            for (i = 0; i < n; i++) x[i] = v[i];
                            cleanup(v);
                        });
                    }
                } else if (typeof require !== 'undefined') {
                    // Node.js.
                    crypto = require('crypto');
                    if (crypto) {
                        nacl.setPRNG(function(x, n) {
                            var i, v = crypto.randomBytes(n);
                            for (i = 0; i < n; i++) x[i] = v[i];
                            cleanup(v);
                        });
                    }
                }
            })();

        })(typeof module !== 'undefined' && module.exports ? module.exports : (window.nacl = window.nacl || {}));

    }).call(this,require("buffer").Buffer)
},{"buffer":30,"crypto":30}],30:[function(require,module,exports){

},{}],31:[function(require,module,exports){
    (function (global){
        /*!
         * The buffer module from node.js, for the browser.
         *
         * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
         * @license  MIT
         */
        /* eslint-disable no-proto */

        var base64 = require('base64-js')
        var ieee754 = require('ieee754')
        var isArray = require('is-array')

        exports.Buffer = Buffer
        exports.SlowBuffer = SlowBuffer
        exports.INSPECT_MAX_BYTES = 50
        Buffer.poolSize = 8192 // not used by this implementation

        var rootParent = {}

        /**
         * If `Buffer.TYPED_ARRAY_SUPPORT`:
         *   === true    Use Uint8Array implementation (fastest)
         *   === false   Use Object implementation (most compatible, even IE6)
         *
         * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
         * Opera 11.6+, iOS 4.2+.
         *
         * Due to various browser bugs, sometimes the Object implementation will be used even
         * when the browser supports typed arrays.
         *
         * Note:
         *
         *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
         *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
         *
         *   - Safari 5-7 lacks support for changing the `Object.prototype.constructor` property
         *     on objects.
         *
         *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
         *
         *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
         *     incorrect length in some situations.

         * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
         * get the Object implementation, which is slower but behaves correctly.
         */
        Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
            ? global.TYPED_ARRAY_SUPPORT
            : (function () {
            function Bar () {}
            try {
                var arr = new Uint8Array(1)
                arr.foo = function () { return 42 }
                arr.constructor = Bar
                return arr.foo() === 42 && // typed array instances can be augmented
                    arr.constructor === Bar && // constructor can be set
                    typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
                    arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
            } catch (e) {
                return false
            }
        })()

        function kMaxLength () {
            return Buffer.TYPED_ARRAY_SUPPORT
                ? 0x7fffffff
                : 0x3fffffff
        }

        /**
         * Class: Buffer
         * =============
         *
         * The Buffer constructor returns instances of `Uint8Array` that are augmented
         * with function properties for all the node `Buffer` API functions. We use
         * `Uint8Array` so that square bracket notation works as expected -- it returns
         * a single octet.
         *
         * By augmenting the instances, we can avoid modifying the `Uint8Array`
         * prototype.
         */
        function Buffer (arg) {
            if (!(this instanceof Buffer)) {
                // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
                if (arguments.length > 1) return new Buffer(arg, arguments[1])
                return new Buffer(arg)
            }

            this.length = 0
            this.parent = undefined

            // Common case.
            if (typeof arg === 'number') {
                return fromNumber(this, arg)
            }

            // Slightly less common case.
            if (typeof arg === 'string') {
                return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
            }

            // Unusual.
            return fromObject(this, arg)
        }

        function fromNumber (that, length) {
            that = allocate(that, length < 0 ? 0 : checked(length) | 0)
            if (!Buffer.TYPED_ARRAY_SUPPORT) {
                for (var i = 0; i < length; i++) {
                    that[i] = 0
                }
            }
            return that
        }

        function fromString (that, string, encoding) {
            if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

            // Assumption: byteLength() return value is always < kMaxLength.
            var length = byteLength(string, encoding) | 0
            that = allocate(that, length)

            that.write(string, encoding)
            return that
        }

        function fromObject (that, object) {
            if (Buffer.isBuffer(object)) return fromBuffer(that, object)

            if (isArray(object)) return fromArray(that, object)

            if (object == null) {
                throw new TypeError('must start with number, buffer, array or string')
            }

            if (typeof ArrayBuffer !== 'undefined') {
                if (object.buffer instanceof ArrayBuffer) {
                    return fromTypedArray(that, object)
                }
                if (object instanceof ArrayBuffer) {
                    return fromArrayBuffer(that, object)
                }
            }

            if (object.length) return fromArrayLike(that, object)

            return fromJsonObject(that, object)
        }

        function fromBuffer (that, buffer) {
            var length = checked(buffer.length) | 0
            that = allocate(that, length)
            buffer.copy(that, 0, 0, length)
            return that
        }

        function fromArray (that, array) {
            var length = checked(array.length) | 0
            that = allocate(that, length)
            for (var i = 0; i < length; i += 1) {
                that[i] = array[i] & 255
            }
            return that
        }

// Duplicate of fromArray() to keep fromArray() monomorphic.
        function fromTypedArray (that, array) {
            var length = checked(array.length) | 0
            that = allocate(that, length)
            // Truncating the elements is probably not what people expect from typed
            // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
            // of the old Buffer constructor.
            for (var i = 0; i < length; i += 1) {
                that[i] = array[i] & 255
            }
            return that
        }

        function fromArrayBuffer (that, array) {
            if (Buffer.TYPED_ARRAY_SUPPORT) {
                // Return an augmented `Uint8Array` instance, for best performance
                array.byteLength
                that = Buffer._augment(new Uint8Array(array))
            } else {
                // Fallback: Return an object instance of the Buffer class
                that = fromTypedArray(that, new Uint8Array(array))
            }
            return that
        }

        function fromArrayLike (that, array) {
            var length = checked(array.length) | 0
            that = allocate(that, length)
            for (var i = 0; i < length; i += 1) {
                that[i] = array[i] & 255
            }
            return that
        }

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
        function fromJsonObject (that, object) {
            var array
            var length = 0

            if (object.type === 'Buffer' && isArray(object.data)) {
                array = object.data
                length = checked(array.length) | 0
            }
            that = allocate(that, length)

            for (var i = 0; i < length; i += 1) {
                that[i] = array[i] & 255
            }
            return that
        }

        if (Buffer.TYPED_ARRAY_SUPPORT) {
            Buffer.prototype.__proto__ = Uint8Array.prototype
            Buffer.__proto__ = Uint8Array
        }

        function allocate (that, length) {
            if (Buffer.TYPED_ARRAY_SUPPORT) {
                // Return an augmented `Uint8Array` instance, for best performance
                that = Buffer._augment(new Uint8Array(length))
                that.__proto__ = Buffer.prototype
            } else {
                // Fallback: Return an object instance of the Buffer class
                that.length = length
                that._isBuffer = true
            }

            var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
            if (fromPool) that.parent = rootParent

            return that
        }

        function checked (length) {
            // Note: cannot use `length < kMaxLength` here because that fails when
            // length is NaN (which is otherwise coerced to zero.)
            if (length >= kMaxLength()) {
                throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                    'size: 0x' + kMaxLength().toString(16) + ' bytes')
            }
            return length | 0
        }

        function SlowBuffer (subject, encoding) {
            if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

            var buf = new Buffer(subject, encoding)
            delete buf.parent
            return buf
        }

        Buffer.isBuffer = function isBuffer (b) {
            return !!(b != null && b._isBuffer)
        }

        Buffer.compare = function compare (a, b) {
            if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
                throw new TypeError('Arguments must be Buffers')
            }

            if (a === b) return 0

            var x = a.length
            var y = b.length

            var i = 0
            var len = Math.min(x, y)
            while (i < len) {
                if (a[i] !== b[i]) break

                ++i
            }

            if (i !== len) {
                x = a[i]
                y = b[i]
            }

            if (x < y) return -1
            if (y < x) return 1
            return 0
        }

        Buffer.isEncoding = function isEncoding (encoding) {
            switch (String(encoding).toLowerCase()) {
                case 'hex':
                case 'utf8':
                case 'utf-8':
                case 'ascii':
                case 'binary':
                case 'base64':
                case 'raw':
                case 'ucs2':
                case 'ucs-2':
                case 'utf16le':
                case 'utf-16le':
                    return true
                default:
                    return false
            }
        }

        Buffer.concat = function concat (list, length) {
            if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

            if (list.length === 0) {
                return new Buffer(0)
            }

            var i
            if (length === undefined) {
                length = 0
                for (i = 0; i < list.length; i++) {
                    length += list[i].length
                }
            }

            var buf = new Buffer(length)
            var pos = 0
            for (i = 0; i < list.length; i++) {
                var item = list[i]
                item.copy(buf, pos)
                pos += item.length
            }
            return buf
        }

        function byteLength (string, encoding) {
            if (typeof string !== 'string') string = '' + string

            var len = string.length
            if (len === 0) return 0

            // Use a for loop to avoid recursion
            var loweredCase = false
            for (;;) {
                switch (encoding) {
                    case 'ascii':
                    case 'binary':
                    // Deprecated
                    case 'raw':
                    case 'raws':
                        return len
                    case 'utf8':
                    case 'utf-8':
                        return utf8ToBytes(string).length
                    case 'ucs2':
                    case 'ucs-2':
                    case 'utf16le':
                    case 'utf-16le':
                        return len * 2
                    case 'hex':
                        return len >>> 1
                    case 'base64':
                        return base64ToBytes(string).length
                    default:
                        if (loweredCase) return utf8ToBytes(string).length // assume utf8
                        encoding = ('' + encoding).toLowerCase()
                        loweredCase = true
                }
            }
        }
        Buffer.byteLength = byteLength

// pre-set for values that may exist in the future
        Buffer.prototype.length = undefined
        Buffer.prototype.parent = undefined

        function slowToString (encoding, start, end) {
            var loweredCase = false

            start = start | 0
            end = end === undefined || end === Infinity ? this.length : end | 0

            if (!encoding) encoding = 'utf8'
            if (start < 0) start = 0
            if (end > this.length) end = this.length
            if (end <= start) return ''

            while (true) {
                switch (encoding) {
                    case 'hex':
                        return hexSlice(this, start, end)

                    case 'utf8':
                    case 'utf-8':
                        return utf8Slice(this, start, end)

                    case 'ascii':
                        return asciiSlice(this, start, end)

                    case 'binary':
                        return binarySlice(this, start, end)

                    case 'base64':
                        return base64Slice(this, start, end)

                    case 'ucs2':
                    case 'ucs-2':
                    case 'utf16le':
                    case 'utf-16le':
                        return utf16leSlice(this, start, end)

                    default:
                        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
                        encoding = (encoding + '').toLowerCase()
                        loweredCase = true
                }
            }
        }

        Buffer.prototype.toString = function toString () {
            var length = this.length | 0
            if (length === 0) return ''
            if (arguments.length === 0) return utf8Slice(this, 0, length)
            return slowToString.apply(this, arguments)
        }

        Buffer.prototype.equals = function equals (b) {
            if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
            if (this === b) return true
            return Buffer.compare(this, b) === 0
        }

        Buffer.prototype.inspect = function inspect () {
            var str = ''
            var max = exports.INSPECT_MAX_BYTES
            if (this.length > 0) {
                str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
                if (this.length > max) str += ' ... '
            }
            return '<Buffer ' + str + '>'
        }

        Buffer.prototype.compare = function compare (b) {
            if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
            if (this === b) return 0
            return Buffer.compare(this, b)
        }

        Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
            if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
            else if (byteOffset < -0x80000000) byteOffset = -0x80000000
            byteOffset >>= 0

            if (this.length === 0) return -1
            if (byteOffset >= this.length) return -1

            // Negative offsets start from the end of the buffer
            if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

            if (typeof val === 'string') {
                if (val.length === 0) return -1 // special case: looking for empty string always fails
                return String.prototype.indexOf.call(this, val, byteOffset)
            }
            if (Buffer.isBuffer(val)) {
                return arrayIndexOf(this, val, byteOffset)
            }
            if (typeof val === 'number') {
                if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
                    return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
                }
                return arrayIndexOf(this, [ val ], byteOffset)
            }

            function arrayIndexOf (arr, val, byteOffset) {
                var foundIndex = -1
                for (var i = 0; byteOffset + i < arr.length; i++) {
                    if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
                        if (foundIndex === -1) foundIndex = i
                        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
                    } else {
                        foundIndex = -1
                    }
                }
                return -1
            }

            throw new TypeError('val must be string, number or Buffer')
        }

// `get` is deprecated
        Buffer.prototype.get = function get (offset) {
            console.log('.get() is deprecated. Access using array indexes instead.')
            return this.readUInt8(offset)
        }

// `set` is deprecated
        Buffer.prototype.set = function set (v, offset) {
            console.log('.set() is deprecated. Access using array indexes instead.')
            return this.writeUInt8(v, offset)
        }

        function hexWrite (buf, string, offset, length) {
            offset = Number(offset) || 0
            var remaining = buf.length - offset
            if (!length) {
                length = remaining
            } else {
                length = Number(length)
                if (length > remaining) {
                    length = remaining
                }
            }

            // must be an even number of digits
            var strLen = string.length
            if (strLen % 2 !== 0) throw new Error('Invalid hex string')

            if (length > strLen / 2) {
                length = strLen / 2
            }
            for (var i = 0; i < length; i++) {
                var parsed = parseInt(string.substr(i * 2, 2), 16)
                if (isNaN(parsed)) throw new Error('Invalid hex string')
                buf[offset + i] = parsed
            }
            return i
        }

        function utf8Write (buf, string, offset, length) {
            return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
        }

        function asciiWrite (buf, string, offset, length) {
            return blitBuffer(asciiToBytes(string), buf, offset, length)
        }

        function binaryWrite (buf, string, offset, length) {
            return asciiWrite(buf, string, offset, length)
        }

        function base64Write (buf, string, offset, length) {
            return blitBuffer(base64ToBytes(string), buf, offset, length)
        }

        function ucs2Write (buf, string, offset, length) {
            return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
        }

        Buffer.prototype.write = function write (string, offset, length, encoding) {
            // Buffer#write(string)
            if (offset === undefined) {
                encoding = 'utf8'
                length = this.length
                offset = 0
                // Buffer#write(string, encoding)
            } else if (length === undefined && typeof offset === 'string') {
                encoding = offset
                length = this.length
                offset = 0
                // Buffer#write(string, offset[, length][, encoding])
            } else if (isFinite(offset)) {
                offset = offset | 0
                if (isFinite(length)) {
                    length = length | 0
                    if (encoding === undefined) encoding = 'utf8'
                } else {
                    encoding = length
                    length = undefined
                }
                // legacy write(string, encoding, offset, length) - remove in v0.13
            } else {
                var swap = encoding
                encoding = offset
                offset = length | 0
                length = swap
            }

            var remaining = this.length - offset
            if (length === undefined || length > remaining) length = remaining

            if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
                throw new RangeError('attempt to write outside buffer bounds')
            }

            if (!encoding) encoding = 'utf8'

            var loweredCase = false
            for (;;) {
                switch (encoding) {
                    case 'hex':
                        return hexWrite(this, string, offset, length)

                    case 'utf8':
                    case 'utf-8':
                        return utf8Write(this, string, offset, length)

                    case 'ascii':
                        return asciiWrite(this, string, offset, length)

                    case 'binary':
                        return binaryWrite(this, string, offset, length)

                    case 'base64':
                        // Warning: maxLength not taken into account in base64Write
                        return base64Write(this, string, offset, length)

                    case 'ucs2':
                    case 'ucs-2':
                    case 'utf16le':
                    case 'utf-16le':
                        return ucs2Write(this, string, offset, length)

                    default:
                        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
                        encoding = ('' + encoding).toLowerCase()
                        loweredCase = true
                }
            }
        }

        Buffer.prototype.toJSON = function toJSON () {
            return {
                type: 'Buffer',
                data: Array.prototype.slice.call(this._arr || this, 0)
            }
        }

        function base64Slice (buf, start, end) {
            if (start === 0 && end === buf.length) {
                return base64.fromByteArray(buf)
            } else {
                return base64.fromByteArray(buf.slice(start, end))
            }
        }

        function utf8Slice (buf, start, end) {
            end = Math.min(buf.length, end)
            var res = []

            var i = start
            while (i < end) {
                var firstByte = buf[i]
                var codePoint = null
                var bytesPerSequence = (firstByte > 0xEF) ? 4
                    : (firstByte > 0xDF) ? 3
                    : (firstByte > 0xBF) ? 2
                    : 1

                if (i + bytesPerSequence <= end) {
                    var secondByte, thirdByte, fourthByte, tempCodePoint

                    switch (bytesPerSequence) {
                        case 1:
                            if (firstByte < 0x80) {
                                codePoint = firstByte
                            }
                            break
                        case 2:
                            secondByte = buf[i + 1]
                            if ((secondByte & 0xC0) === 0x80) {
                                tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
                                if (tempCodePoint > 0x7F) {
                                    codePoint = tempCodePoint
                                }
                            }
                            break
                        case 3:
                            secondByte = buf[i + 1]
                            thirdByte = buf[i + 2]
                            if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
                                tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
                                if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
                                    codePoint = tempCodePoint
                                }
                            }
                            break
                        case 4:
                            secondByte = buf[i + 1]
                            thirdByte = buf[i + 2]
                            fourthByte = buf[i + 3]
                            if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
                                tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
                                if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
                                    codePoint = tempCodePoint
                                }
                            }
                    }
                }

                if (codePoint === null) {
                    // we did not generate a valid codePoint so insert a
                    // replacement char (U+FFFD) and advance only 1 byte
                    codePoint = 0xFFFD
                    bytesPerSequence = 1
                } else if (codePoint > 0xFFFF) {
                    // encode to utf16 (surrogate pair dance)
                    codePoint -= 0x10000
                    res.push(codePoint >>> 10 & 0x3FF | 0xD800)
                    codePoint = 0xDC00 | codePoint & 0x3FF
                }

                res.push(codePoint)
                i += bytesPerSequence
            }

            return decodeCodePointsArray(res)
        }

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
        var MAX_ARGUMENTS_LENGTH = 0x1000

        function decodeCodePointsArray (codePoints) {
            var len = codePoints.length
            if (len <= MAX_ARGUMENTS_LENGTH) {
                return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
            }

            // Decode in chunks to avoid "call stack size exceeded".
            var res = ''
            var i = 0
            while (i < len) {
                res += String.fromCharCode.apply(
                    String,
                    codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
                )
            }
            return res
        }

        function asciiSlice (buf, start, end) {
            var ret = ''
            end = Math.min(buf.length, end)

            for (var i = start; i < end; i++) {
                ret += String.fromCharCode(buf[i] & 0x7F)
            }
            return ret
        }

        function binarySlice (buf, start, end) {
            var ret = ''
            end = Math.min(buf.length, end)

            for (var i = start; i < end; i++) {
                ret += String.fromCharCode(buf[i])
            }
            return ret
        }

        function hexSlice (buf, start, end) {
            var len = buf.length

            if (!start || start < 0) start = 0
            if (!end || end < 0 || end > len) end = len

            var out = ''
            for (var i = start; i < end; i++) {
                out += toHex(buf[i])
            }
            return out
        }

        function utf16leSlice (buf, start, end) {
            var bytes = buf.slice(start, end)
            var res = ''
            for (var i = 0; i < bytes.length; i += 2) {
                res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
            }
            return res
        }

        Buffer.prototype.slice = function slice (start, end) {
            var len = this.length
            start = ~~start
            end = end === undefined ? len : ~~end

            if (start < 0) {
                start += len
                if (start < 0) start = 0
            } else if (start > len) {
                start = len
            }

            if (end < 0) {
                end += len
                if (end < 0) end = 0
            } else if (end > len) {
                end = len
            }

            if (end < start) end = start

            var newBuf
            if (Buffer.TYPED_ARRAY_SUPPORT) {
                newBuf = Buffer._augment(this.subarray(start, end))
            } else {
                var sliceLen = end - start
                newBuf = new Buffer(sliceLen, undefined)
                for (var i = 0; i < sliceLen; i++) {
                    newBuf[i] = this[i + start]
                }
            }

            if (newBuf.length) newBuf.parent = this.parent || this

            return newBuf
        }

        /*
         * Need to make sure that buffer isn't trying to write out of bounds.
         */
        function checkOffset (offset, ext, length) {
            if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
            if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
        }

        Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
            offset = offset | 0
            byteLength = byteLength | 0
            if (!noAssert) checkOffset(offset, byteLength, this.length)

            var val = this[offset]
            var mul = 1
            var i = 0
            while (++i < byteLength && (mul *= 0x100)) {
                val += this[offset + i] * mul
            }

            return val
        }

        Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
            offset = offset | 0
            byteLength = byteLength | 0
            if (!noAssert) {
                checkOffset(offset, byteLength, this.length)
            }

            var val = this[offset + --byteLength]
            var mul = 1
            while (byteLength > 0 && (mul *= 0x100)) {
                val += this[offset + --byteLength] * mul
            }

            return val
        }

        Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
            if (!noAssert) checkOffset(offset, 1, this.length)
            return this[offset]
        }

        Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
            if (!noAssert) checkOffset(offset, 2, this.length)
            return this[offset] | (this[offset + 1] << 8)
        }

        Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
            if (!noAssert) checkOffset(offset, 2, this.length)
            return (this[offset] << 8) | this[offset + 1]
        }

        Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
            if (!noAssert) checkOffset(offset, 4, this.length)

            return ((this[offset]) |
                (this[offset + 1] << 8) |
                (this[offset + 2] << 16)) +
                (this[offset + 3] * 0x1000000)
        }

        Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
            if (!noAssert) checkOffset(offset, 4, this.length)

            return (this[offset] * 0x1000000) +
                ((this[offset + 1] << 16) |
                (this[offset + 2] << 8) |
                this[offset + 3])
        }

        Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
            offset = offset | 0
            byteLength = byteLength | 0
            if (!noAssert) checkOffset(offset, byteLength, this.length)

            var val = this[offset]
            var mul = 1
            var i = 0
            while (++i < byteLength && (mul *= 0x100)) {
                val += this[offset + i] * mul
            }
            mul *= 0x80

            if (val >= mul) val -= Math.pow(2, 8 * byteLength)

            return val
        }

        Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
            offset = offset | 0
            byteLength = byteLength | 0
            if (!noAssert) checkOffset(offset, byteLength, this.length)

            var i = byteLength
            var mul = 1
            var val = this[offset + --i]
            while (i > 0 && (mul *= 0x100)) {
                val += this[offset + --i] * mul
            }
            mul *= 0x80

            if (val >= mul) val -= Math.pow(2, 8 * byteLength)

            return val
        }

        Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
            if (!noAssert) checkOffset(offset, 1, this.length)
            if (!(this[offset] & 0x80)) return (this[offset])
            return ((0xff - this[offset] + 1) * -1)
        }

        Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
            if (!noAssert) checkOffset(offset, 2, this.length)
            var val = this[offset] | (this[offset + 1] << 8)
            return (val & 0x8000) ? val | 0xFFFF0000 : val
        }

        Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
            if (!noAssert) checkOffset(offset, 2, this.length)
            var val = this[offset + 1] | (this[offset] << 8)
            return (val & 0x8000) ? val | 0xFFFF0000 : val
        }

        Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
            if (!noAssert) checkOffset(offset, 4, this.length)

            return (this[offset]) |
                (this[offset + 1] << 8) |
                (this[offset + 2] << 16) |
                (this[offset + 3] << 24)
        }

        Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
            if (!noAssert) checkOffset(offset, 4, this.length)

            return (this[offset] << 24) |
                (this[offset + 1] << 16) |
                (this[offset + 2] << 8) |
                (this[offset + 3])
        }

        Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
            if (!noAssert) checkOffset(offset, 4, this.length)
            return ieee754.read(this, offset, true, 23, 4)
        }

        Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
            if (!noAssert) checkOffset(offset, 4, this.length)
            return ieee754.read(this, offset, false, 23, 4)
        }

        Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
            if (!noAssert) checkOffset(offset, 8, this.length)
            return ieee754.read(this, offset, true, 52, 8)
        }

        Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
            if (!noAssert) checkOffset(offset, 8, this.length)
            return ieee754.read(this, offset, false, 52, 8)
        }

        function checkInt (buf, value, offset, ext, max, min) {
            if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
            if (value > max || value < min) throw new RangeError('value is out of bounds')
            if (offset + ext > buf.length) throw new RangeError('index out of range')
        }

        Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
            value = +value
            offset = offset | 0
            byteLength = byteLength | 0
            if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

            var mul = 1
            var i = 0
            this[offset] = value & 0xFF
            while (++i < byteLength && (mul *= 0x100)) {
                this[offset + i] = (value / mul) & 0xFF
            }

            return offset + byteLength
        }

        Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
            value = +value
            offset = offset | 0
            byteLength = byteLength | 0
            if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

            var i = byteLength - 1
            var mul = 1
            this[offset + i] = value & 0xFF
            while (--i >= 0 && (mul *= 0x100)) {
                this[offset + i] = (value / mul) & 0xFF
            }

            return offset + byteLength
        }

        Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
            value = +value
            offset = offset | 0
            if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
            if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
            this[offset] = value
            return offset + 1
        }

        function objectWriteUInt16 (buf, value, offset, littleEndian) {
            if (value < 0) value = 0xffff + value + 1
            for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
                buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
                    (littleEndian ? i : 1 - i) * 8
            }
        }

        Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
            value = +value
            offset = offset | 0
            if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
            if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = value
                this[offset + 1] = (value >>> 8)
            } else {
                objectWriteUInt16(this, value, offset, true)
            }
            return offset + 2
        }

        Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
            value = +value
            offset = offset | 0
            if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
            if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value >>> 8)
                this[offset + 1] = value
            } else {
                objectWriteUInt16(this, value, offset, false)
            }
            return offset + 2
        }

        function objectWriteUInt32 (buf, value, offset, littleEndian) {
            if (value < 0) value = 0xffffffff + value + 1
            for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
                buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
            }
        }

        Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
            value = +value
            offset = offset | 0
            if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
            if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset + 3] = (value >>> 24)
                this[offset + 2] = (value >>> 16)
                this[offset + 1] = (value >>> 8)
                this[offset] = value
            } else {
                objectWriteUInt32(this, value, offset, true)
            }
            return offset + 4
        }

        Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
            value = +value
            offset = offset | 0
            if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
            if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value >>> 24)
                this[offset + 1] = (value >>> 16)
                this[offset + 2] = (value >>> 8)
                this[offset + 3] = value
            } else {
                objectWriteUInt32(this, value, offset, false)
            }
            return offset + 4
        }

        Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
            value = +value
            offset = offset | 0
            if (!noAssert) {
                var limit = Math.pow(2, 8 * byteLength - 1)

                checkInt(this, value, offset, byteLength, limit - 1, -limit)
            }

            var i = 0
            var mul = 1
            var sub = value < 0 ? 1 : 0
            this[offset] = value & 0xFF
            while (++i < byteLength && (mul *= 0x100)) {
                this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
            }

            return offset + byteLength
        }

        Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
            value = +value
            offset = offset | 0
            if (!noAssert) {
                var limit = Math.pow(2, 8 * byteLength - 1)

                checkInt(this, value, offset, byteLength, limit - 1, -limit)
            }

            var i = byteLength - 1
            var mul = 1
            var sub = value < 0 ? 1 : 0
            this[offset + i] = value & 0xFF
            while (--i >= 0 && (mul *= 0x100)) {
                this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
            }

            return offset + byteLength
        }

        Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
            value = +value
            offset = offset | 0
            if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
            if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
            if (value < 0) value = 0xff + value + 1
            this[offset] = value
            return offset + 1
        }

        Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
            value = +value
            offset = offset | 0
            if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
            if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = value
                this[offset + 1] = (value >>> 8)
            } else {
                objectWriteUInt16(this, value, offset, true)
            }
            return offset + 2
        }

        Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
            value = +value
            offset = offset | 0
            if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
            if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value >>> 8)
                this[offset + 1] = value
            } else {
                objectWriteUInt16(this, value, offset, false)
            }
            return offset + 2
        }

        Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
            value = +value
            offset = offset | 0
            if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
            if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = value
                this[offset + 1] = (value >>> 8)
                this[offset + 2] = (value >>> 16)
                this[offset + 3] = (value >>> 24)
            } else {
                objectWriteUInt32(this, value, offset, true)
            }
            return offset + 4
        }

        Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
            value = +value
            offset = offset | 0
            if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
            if (value < 0) value = 0xffffffff + value + 1
            if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value >>> 24)
                this[offset + 1] = (value >>> 16)
                this[offset + 2] = (value >>> 8)
                this[offset + 3] = value
            } else {
                objectWriteUInt32(this, value, offset, false)
            }
            return offset + 4
        }

        function checkIEEE754 (buf, value, offset, ext, max, min) {
            if (value > max || value < min) throw new RangeError('value is out of bounds')
            if (offset + ext > buf.length) throw new RangeError('index out of range')
            if (offset < 0) throw new RangeError('index out of range')
        }

        function writeFloat (buf, value, offset, littleEndian, noAssert) {
            if (!noAssert) {
                checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
            }
            ieee754.write(buf, value, offset, littleEndian, 23, 4)
            return offset + 4
        }

        Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
            return writeFloat(this, value, offset, true, noAssert)
        }

        Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
            return writeFloat(this, value, offset, false, noAssert)
        }

        function writeDouble (buf, value, offset, littleEndian, noAssert) {
            if (!noAssert) {
                checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
            }
            ieee754.write(buf, value, offset, littleEndian, 52, 8)
            return offset + 8
        }

        Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
            return writeDouble(this, value, offset, true, noAssert)
        }

        Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
            return writeDouble(this, value, offset, false, noAssert)
        }

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
        Buffer.prototype.copy = function copy (target, targetStart, start, end) {
            if (!start) start = 0
            if (!end && end !== 0) end = this.length
            if (targetStart >= target.length) targetStart = target.length
            if (!targetStart) targetStart = 0
            if (end > 0 && end < start) end = start

            // Copy 0 bytes; we're done
            if (end === start) return 0
            if (target.length === 0 || this.length === 0) return 0

            // Fatal error conditions
            if (targetStart < 0) {
                throw new RangeError('targetStart out of bounds')
            }
            if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
            if (end < 0) throw new RangeError('sourceEnd out of bounds')

            // Are we oob?
            if (end > this.length) end = this.length
            if (target.length - targetStart < end - start) {
                end = target.length - targetStart + start
            }

            var len = end - start
            var i

            if (this === target && start < targetStart && targetStart < end) {
                // descending copy from end
                for (i = len - 1; i >= 0; i--) {
                    target[i + targetStart] = this[i + start]
                }
            } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
                // ascending copy from start
                for (i = 0; i < len; i++) {
                    target[i + targetStart] = this[i + start]
                }
            } else {
                target._set(this.subarray(start, start + len), targetStart)
            }

            return len
        }

// fill(value, start=0, end=buffer.length)
        Buffer.prototype.fill = function fill (value, start, end) {
            if (!value) value = 0
            if (!start) start = 0
            if (!end) end = this.length

            if (end < start) throw new RangeError('end < start')

            // Fill 0 bytes; we're done
            if (end === start) return
            if (this.length === 0) return

            if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
            if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

            var i
            if (typeof value === 'number') {
                for (i = start; i < end; i++) {
                    this[i] = value
                }
            } else {
                var bytes = utf8ToBytes(value.toString())
                var len = bytes.length
                for (i = start; i < end; i++) {
                    this[i] = bytes[i % len]
                }
            }

            return this
        }

        /**
         * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
         * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
         */
        Buffer.prototype.toArrayBuffer = function toArrayBuffer () {
            if (typeof Uint8Array !== 'undefined') {
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    return (new Buffer(this)).buffer
                } else {
                    var buf = new Uint8Array(this.length)
                    for (var i = 0, len = buf.length; i < len; i += 1) {
                        buf[i] = this[i]
                    }
                    return buf.buffer
                }
            } else {
                throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
            }
        }

// HELPER FUNCTIONS
// ================

        var BP = Buffer.prototype

        /**
         * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
         */
        Buffer._augment = function _augment (arr) {
            arr.constructor = Buffer
            arr._isBuffer = true

            // save reference to original Uint8Array set method before overwriting
            arr._set = arr.set

            // deprecated
            arr.get = BP.get
            arr.set = BP.set

            arr.write = BP.write
            arr.toString = BP.toString
            arr.toLocaleString = BP.toString
            arr.toJSON = BP.toJSON
            arr.equals = BP.equals
            arr.compare = BP.compare
            arr.indexOf = BP.indexOf
            arr.copy = BP.copy
            arr.slice = BP.slice
            arr.readUIntLE = BP.readUIntLE
            arr.readUIntBE = BP.readUIntBE
            arr.readUInt8 = BP.readUInt8
            arr.readUInt16LE = BP.readUInt16LE
            arr.readUInt16BE = BP.readUInt16BE
            arr.readUInt32LE = BP.readUInt32LE
            arr.readUInt32BE = BP.readUInt32BE
            arr.readIntLE = BP.readIntLE
            arr.readIntBE = BP.readIntBE
            arr.readInt8 = BP.readInt8
            arr.readInt16LE = BP.readInt16LE
            arr.readInt16BE = BP.readInt16BE
            arr.readInt32LE = BP.readInt32LE
            arr.readInt32BE = BP.readInt32BE
            arr.readFloatLE = BP.readFloatLE
            arr.readFloatBE = BP.readFloatBE
            arr.readDoubleLE = BP.readDoubleLE
            arr.readDoubleBE = BP.readDoubleBE
            arr.writeUInt8 = BP.writeUInt8
            arr.writeUIntLE = BP.writeUIntLE
            arr.writeUIntBE = BP.writeUIntBE
            arr.writeUInt16LE = BP.writeUInt16LE
            arr.writeUInt16BE = BP.writeUInt16BE
            arr.writeUInt32LE = BP.writeUInt32LE
            arr.writeUInt32BE = BP.writeUInt32BE
            arr.writeIntLE = BP.writeIntLE
            arr.writeIntBE = BP.writeIntBE
            arr.writeInt8 = BP.writeInt8
            arr.writeInt16LE = BP.writeInt16LE
            arr.writeInt16BE = BP.writeInt16BE
            arr.writeInt32LE = BP.writeInt32LE
            arr.writeInt32BE = BP.writeInt32BE
            arr.writeFloatLE = BP.writeFloatLE
            arr.writeFloatBE = BP.writeFloatBE
            arr.writeDoubleLE = BP.writeDoubleLE
            arr.writeDoubleBE = BP.writeDoubleBE
            arr.fill = BP.fill
            arr.inspect = BP.inspect
            arr.toArrayBuffer = BP.toArrayBuffer

            return arr
        }

        var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

        function base64clean (str) {
            // Node strips out invalid characters like \n and \t from the string, base64-js does not
            str = stringtrim(str).replace(INVALID_BASE64_RE, '')
            // Node converts strings with length < 2 to ''
            if (str.length < 2) return ''
            // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
            while (str.length % 4 !== 0) {
                str = str + '='
            }
            return str
        }

        function stringtrim (str) {
            if (str.trim) return str.trim()
            return str.replace(/^\s+|\s+$/g, '')
        }

        function toHex (n) {
            if (n < 16) return '0' + n.toString(16)
            return n.toString(16)
        }

        function utf8ToBytes (string, units) {
            units = units || Infinity
            var codePoint
            var length = string.length
            var leadSurrogate = null
            var bytes = []

            for (var i = 0; i < length; i++) {
                codePoint = string.charCodeAt(i)

                // is surrogate component
                if (codePoint > 0xD7FF && codePoint < 0xE000) {
                    // last char was a lead
                    if (!leadSurrogate) {
                        // no lead yet
                        if (codePoint > 0xDBFF) {
                            // unexpected trail
                            if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                            continue
                        } else if (i + 1 === length) {
                            // unpaired lead
                            if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                            continue
                        }

                        // valid lead
                        leadSurrogate = codePoint

                        continue
                    }

                    // 2 leads in a row
                    if (codePoint < 0xDC00) {
                        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                        leadSurrogate = codePoint
                        continue
                    }

                    // valid surrogate pair
                    codePoint = leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00 | 0x10000
                } else if (leadSurrogate) {
                    // valid bmp char, but last char was a lead
                    if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                }

                leadSurrogate = null

                // encode utf8
                if (codePoint < 0x80) {
                    if ((units -= 1) < 0) break
                    bytes.push(codePoint)
                } else if (codePoint < 0x800) {
                    if ((units -= 2) < 0) break
                    bytes.push(
                        codePoint >> 0x6 | 0xC0,
                        codePoint & 0x3F | 0x80
                    )
                } else if (codePoint < 0x10000) {
                    if ((units -= 3) < 0) break
                    bytes.push(
                        codePoint >> 0xC | 0xE0,
                        codePoint >> 0x6 & 0x3F | 0x80,
                        codePoint & 0x3F | 0x80
                    )
                } else if (codePoint < 0x110000) {
                    if ((units -= 4) < 0) break
                    bytes.push(
                        codePoint >> 0x12 | 0xF0,
                        codePoint >> 0xC & 0x3F | 0x80,
                        codePoint >> 0x6 & 0x3F | 0x80,
                        codePoint & 0x3F | 0x80
                    )
                } else {
                    throw new Error('Invalid code point')
                }
            }

            return bytes
        }

        function asciiToBytes (str) {
            var byteArray = []
            for (var i = 0; i < str.length; i++) {
                // Node's code seems to be doing this and not & 0x7F..
                byteArray.push(str.charCodeAt(i) & 0xFF)
            }
            return byteArray
        }

        function utf16leToBytes (str, units) {
            var c, hi, lo
            var byteArray = []
            for (var i = 0; i < str.length; i++) {
                if ((units -= 2) < 0) break

                c = str.charCodeAt(i)
                hi = c >> 8
                lo = c % 256
                byteArray.push(lo)
                byteArray.push(hi)
            }

            return byteArray
        }

        function base64ToBytes (str) {
            return base64.toByteArray(base64clean(str))
        }

        function blitBuffer (src, dst, offset, length) {
            for (var i = 0; i < length; i++) {
                if ((i + offset >= dst.length) || (i >= src.length)) break
                dst[i + offset] = src[i]
            }
            return i
        }

    }).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"base64-js":32,"ieee754":33,"is-array":34}],32:[function(require,module,exports){
    var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    ;(function (exports) {
        'use strict';

        var Arr = (typeof Uint8Array !== 'undefined')
            ? Uint8Array
            : Array

        var PLUS   = '+'.charCodeAt(0)
        var SLASH  = '/'.charCodeAt(0)
        var NUMBER = '0'.charCodeAt(0)
        var LOWER  = 'a'.charCodeAt(0)
        var UPPER  = 'A'.charCodeAt(0)
        var PLUS_URL_SAFE = '-'.charCodeAt(0)
        var SLASH_URL_SAFE = '_'.charCodeAt(0)

        function decode (elt) {
            var code = elt.charCodeAt(0)
            if (code === PLUS ||
                code === PLUS_URL_SAFE)
                return 62 // '+'
            if (code === SLASH ||
                code === SLASH_URL_SAFE)
                return 63 // '/'
            if (code < NUMBER)
                return -1 //no match
            if (code < NUMBER + 10)
                return code - NUMBER + 26 + 26
            if (code < UPPER + 26)
                return code - UPPER
            if (code < LOWER + 26)
                return code - LOWER + 26
        }

        function b64ToByteArray (b64) {
            var i, j, l, tmp, placeHolders, arr

            if (b64.length % 4 > 0) {
                throw new Error('Invalid string. Length must be a multiple of 4')
            }

            // the number of equal signs (place holders)
            // if there are two placeholders, than the two characters before it
            // represent one byte
            // if there is only one, then the three characters before it represent 2 bytes
            // this is just a cheap hack to not do indexOf twice
            var len = b64.length
            placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

            // base64 is 4/3 + up to two characters of the original data
            arr = new Arr(b64.length * 3 / 4 - placeHolders)

            // if there are placeholders, only get up to the last complete 4 chars
            l = placeHolders > 0 ? b64.length - 4 : b64.length

            var L = 0

            function push (v) {
                arr[L++] = v
            }

            for (i = 0, j = 0; i < l; i += 4, j += 3) {
                tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
                push((tmp & 0xFF0000) >> 16)
                push((tmp & 0xFF00) >> 8)
                push(tmp & 0xFF)
            }

            if (placeHolders === 2) {
                tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
                push(tmp & 0xFF)
            } else if (placeHolders === 1) {
                tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
                push((tmp >> 8) & 0xFF)
                push(tmp & 0xFF)
            }

            return arr
        }

        function uint8ToBase64 (uint8) {
            var i,
                extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
                output = "",
                temp, length

            function encode (num) {
                return lookup.charAt(num)
            }

            function tripletToBase64 (num) {
                return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
            }

            // go through the array every three bytes, we'll deal with trailing stuff later
            for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
                temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
                output += tripletToBase64(temp)
            }

            // pad the end with zeros, but make sure to not forget the extra bytes
            switch (extraBytes) {
                case 1:
                    temp = uint8[uint8.length - 1]
                    output += encode(temp >> 2)
                    output += encode((temp << 4) & 0x3F)
                    output += '=='
                    break
                case 2:
                    temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
                    output += encode(temp >> 10)
                    output += encode((temp >> 4) & 0x3F)
                    output += encode((temp << 2) & 0x3F)
                    output += '='
                    break
            }

            return output
        }

        exports.toByteArray = b64ToByteArray
        exports.fromByteArray = uint8ToBase64
    }(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],33:[function(require,module,exports){
    exports.read = function (buffer, offset, isLE, mLen, nBytes) {
        var e, m
        var eLen = nBytes * 8 - mLen - 1
        var eMax = (1 << eLen) - 1
        var eBias = eMax >> 1
        var nBits = -7
        var i = isLE ? (nBytes - 1) : 0
        var d = isLE ? -1 : 1
        var s = buffer[offset + i]

        i += d

        e = s & ((1 << (-nBits)) - 1)
        s >>= (-nBits)
        nBits += eLen
        for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

        m = e & ((1 << (-nBits)) - 1)
        e >>= (-nBits)
        nBits += mLen
        for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

        if (e === 0) {
            e = 1 - eBias
        } else if (e === eMax) {
            return m ? NaN : ((s ? -1 : 1) * Infinity)
        } else {
            m = m + Math.pow(2, mLen)
            e = e - eBias
        }
        return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
    }

    exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
        var e, m, c
        var eLen = nBytes * 8 - mLen - 1
        var eMax = (1 << eLen) - 1
        var eBias = eMax >> 1
        var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
        var i = isLE ? 0 : (nBytes - 1)
        var d = isLE ? 1 : -1
        var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

        value = Math.abs(value)

        if (isNaN(value) || value === Infinity) {
            m = isNaN(value) ? 1 : 0
            e = eMax
        } else {
            e = Math.floor(Math.log(value) / Math.LN2)
            if (value * (c = Math.pow(2, -e)) < 1) {
                e--
                c *= 2
            }
            if (e + eBias >= 1) {
                value += rt / c
            } else {
                value += rt * Math.pow(2, 1 - eBias)
            }
            if (value * c >= 2) {
                e++
                c /= 2
            }

            if (e + eBias >= eMax) {
                m = 0
                e = eMax
            } else if (e + eBias >= 1) {
                m = (value * c - 1) * Math.pow(2, mLen)
                e = e + eBias
            } else {
                m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
                e = 0
            }
        }

        for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

        e = (e << mLen) | m
        eLen += mLen
        for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

        buffer[offset + i - d] |= s * 128
    }

},{}],34:[function(require,module,exports){

    /**
     * isArray
     */

    var isArray = Array.isArray;

    /**
     * toString
     */

    var str = Object.prototype.toString;

    /**
     * Whether or not the given `val`
     * is an array.
     *
     * example:
     *
     *        isArray([]);
     *        // > true
     *        isArray(arguments);
     *        // > false
     *        isArray('');
     *        // > false
     *
     * @param {mixed} val
     * @return {bool}
     */

    module.exports = isArray || function (val) {
            return !! val && '[object Array]' == str.call(val);
        };

},{}],35:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

    function EventEmitter() {
        this._events = this._events || {};
        this._maxListeners = this._maxListeners || undefined;
    }
    module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
    EventEmitter.EventEmitter = EventEmitter;

    EventEmitter.prototype._events = undefined;
    EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
    EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
    EventEmitter.prototype.setMaxListeners = function(n) {
        if (!isNumber(n) || n < 0 || isNaN(n))
            throw TypeError('n must be a positive number');
        this._maxListeners = n;
        return this;
    };

    EventEmitter.prototype.emit = function(type) {
        var er, handler, len, args, i, listeners;

        if (!this._events)
            this._events = {};

        // If there is no 'error' event listener then throw.
        if (type === 'error') {
            if (!this._events.error ||
                (isObject(this._events.error) && !this._events.error.length)) {
                er = arguments[1];
                if (er instanceof Error) {
                    throw er; // Unhandled 'error' event
                }
                throw TypeError('Uncaught, unspecified "error" event.');
            }
        }

        handler = this._events[type];

        if (isUndefined(handler))
            return false;

        if (isFunction(handler)) {
            switch (arguments.length) {
                // fast cases
                case 1:
                    handler.call(this);
                    break;
                case 2:
                    handler.call(this, arguments[1]);
                    break;
                case 3:
                    handler.call(this, arguments[1], arguments[2]);
                    break;
                // slower
                default:
                    len = arguments.length;
                    args = new Array(len - 1);
                    for (i = 1; i < len; i++)
                        args[i - 1] = arguments[i];
                    handler.apply(this, args);
            }
        } else if (isObject(handler)) {
            len = arguments.length;
            args = new Array(len - 1);
            for (i = 1; i < len; i++)
                args[i - 1] = arguments[i];

            listeners = handler.slice();
            len = listeners.length;
            for (i = 0; i < len; i++)
                listeners[i].apply(this, args);
        }

        return true;
    };

    EventEmitter.prototype.addListener = function(type, listener) {
        var m;

        if (!isFunction(listener))
            throw TypeError('listener must be a function');

        if (!this._events)
            this._events = {};

        // To avoid recursion in the case that type === "newListener"! Before
        // adding it to the listeners, first emit "newListener".
        if (this._events.newListener)
            this.emit('newListener', type,
                isFunction(listener.listener) ?
                    listener.listener : listener);

        if (!this._events[type])
        // Optimize the case of one listener. Don't need the extra array object.
            this._events[type] = listener;
        else if (isObject(this._events[type]))
        // If we've already got an array, just append.
            this._events[type].push(listener);
        else
        // Adding the second element, need to change to array.
            this._events[type] = [this._events[type], listener];

        // Check for listener leak
        if (isObject(this._events[type]) && !this._events[type].warned) {
            var m;
            if (!isUndefined(this._maxListeners)) {
                m = this._maxListeners;
            } else {
                m = EventEmitter.defaultMaxListeners;
            }

            if (m && m > 0 && this._events[type].length > m) {
                this._events[type].warned = true;
                console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
                if (typeof console.trace === 'function') {
                    // not supported in IE 10
                    console.trace();
                }
            }
        }

        return this;
    };

    EventEmitter.prototype.on = EventEmitter.prototype.addListener;

    EventEmitter.prototype.once = function(type, listener) {
        if (!isFunction(listener))
            throw TypeError('listener must be a function');

        var fired = false;

        function g() {
            this.removeListener(type, g);

            if (!fired) {
                fired = true;
                listener.apply(this, arguments);
            }
        }

        g.listener = listener;
        this.on(type, g);

        return this;
    };

// emits a 'removeListener' event iff the listener was removed
    EventEmitter.prototype.removeListener = function(type, listener) {
        var list, position, length, i;

        if (!isFunction(listener))
            throw TypeError('listener must be a function');

        if (!this._events || !this._events[type])
            return this;

        list = this._events[type];
        length = list.length;
        position = -1;

        if (list === listener ||
            (isFunction(list.listener) && list.listener === listener)) {
            delete this._events[type];
            if (this._events.removeListener)
                this.emit('removeListener', type, listener);

        } else if (isObject(list)) {
            for (i = length; i-- > 0;) {
                if (list[i] === listener ||
                    (list[i].listener && list[i].listener === listener)) {
                    position = i;
                    break;
                }
            }

            if (position < 0)
                return this;

            if (list.length === 1) {
                list.length = 0;
                delete this._events[type];
            } else {
                list.splice(position, 1);
            }

            if (this._events.removeListener)
                this.emit('removeListener', type, listener);
        }

        return this;
    };

    EventEmitter.prototype.removeAllListeners = function(type) {
        var key, listeners;

        if (!this._events)
            return this;

        // not listening for removeListener, no need to emit
        if (!this._events.removeListener) {
            if (arguments.length === 0)
                this._events = {};
            else if (this._events[type])
                delete this._events[type];
            return this;
        }

        // emit removeListener for all listeners on all events
        if (arguments.length === 0) {
            for (key in this._events) {
                if (key === 'removeListener') continue;
                this.removeAllListeners(key);
            }
            this.removeAllListeners('removeListener');
            this._events = {};
            return this;
        }

        listeners = this._events[type];

        if (isFunction(listeners)) {
            this.removeListener(type, listeners);
        } else {
            // LIFO order
            while (listeners.length)
                this.removeListener(type, listeners[listeners.length - 1]);
        }
        delete this._events[type];

        return this;
    };

    EventEmitter.prototype.listeners = function(type) {
        var ret;
        if (!this._events || !this._events[type])
            ret = [];
        else if (isFunction(this._events[type]))
            ret = [this._events[type]];
        else
            ret = this._events[type].slice();
        return ret;
    };

    EventEmitter.listenerCount = function(emitter, type) {
        var ret;
        if (!emitter._events || !emitter._events[type])
            ret = 0;
        else if (isFunction(emitter._events[type]))
            ret = 1;
        else
            ret = emitter._events[type].length;
        return ret;
    };

    function isFunction(arg) {
        return typeof arg === 'function';
    }

    function isNumber(arg) {
        return typeof arg === 'number';
    }

    function isObject(arg) {
        return typeof arg === 'object' && arg !== null;
    }

    function isUndefined(arg) {
        return arg === void 0;
    }

},{}]},{},[2])(2)
});