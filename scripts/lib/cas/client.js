var Command = {
    Session: {
        RESTORE_SESSION: '2oaP9p',
        On: {
            BEGIN_USER_SESSION: 'PLA8R',
            UPDATE_SESSION_TOKEN: 'flqo7'
        }
    }
};

module.exports = Client;

function Client(config, ClientIO, ClientAPI) {
    this.pipe = new ClientIO(config);
    this.config = this.pipe.config;

    this.Enum = this.pipe.Enum;

    this.API = new ClientAPI(this.pipe);
}

Client.prototype.start = function(callback) {
    var self = this;
    this.callback = callback;
    this.pipe.start(function(status, response) {
        switch (status) {
            case self.Enum.Status.CONNECTION_OPENED:
                self.pipe.log.trace(status, response.pipeId);

                self.addSessionTokenListener();
                if (self.callback) self.callback(status, response);

                if (!self.config.MetaData.idToken) {
                    self.restoreSession();
                }
                break;

            case self.Enum.Status.CONNECTION_CLOSED:
                self.pipe.log.trace(status, response.pipeId);
                if (self.callback) self.callback(status, response);
                break;
        }
    });

    return this;
};

Client.prototype.restoreSession = function() {
    if (this.config.MetaData.sessionToken) {
        var self = this,
            param = {
                token: this.config.MetaData.sessionToken
            };

        this.pipe.sendRequest(Command.Session.RESTORE_SESSION, param, null, function(error, result, payload, roundTripTime, networkLatency) {
            if (!error) {
                if (self.callback) self.callback(self.Enum.Status.SESSION_RESTORED);

            } else {
                if (self.callback) self.callback(self.Enum.Status.SESSION_FAILED, error.message);
            }
        });

    } else {
        this.callback(this.Enum.Status.SESSION_FAILED, 'No session token');
    }
};

Client.prototype.addSessionTokenListener = function() {
    var self = this;

    this.pipe.on(Command.Session.On.BEGIN_USER_SESSION, function(error, result, payload, roundTripTime, networkLatency) {
        if (!error) {
            self.config.MetaData.sessionToken = result.token;
            if (self.callback) self.callback(self.Enum.Status.SESSION_RESTORED, result);
        }
    });

    this.pipe.on(Command.Session.On.UPDATE_SESSION_TOKEN, function(error, result, payload, roundTripTime, networkLatency) {
        if (!error) {
            self.config.MetaData.sessionToken = result.token;
            if (self.callback) self.callback(self.Enum.Status.SESSION_UPDATED, result);
        }
    });
};