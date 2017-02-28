/*
 * @copyright Safe Cash Payment Technologies, Inc.
 */

/*
 System generated file.

 On update:
 - File will be backed as 1-index.js, 2-index.js, ...
 - Invalid functions will be removed.
 - All other modifications will be preserved.
 */

var Commands = require('./commands');

module.exports = API;

function API(pipe) {
    this.version = '0.9.7';
    this.pipe = pipe;
    this.pipe.Enum.Command = Commands;
    this.GlobalSessionService = new GlobalSessionService(this.pipe);
    this.AccountService = new AccountService(this.pipe);
    this.MailService = new MailService(this.pipe);
};

function GlobalSessionService(pipe) {};

function MailService(pipe) {};

function AccountService(pipe) {
    this.Account = new Account(pipe);
};

function Account(pipe) {
    this.pipe = pipe;
    this.Enum = this.pipe.Enum;
};

Account.prototype.create = function(param, callback) {
    param.password = this.pipe.md5(param.password);
    this.pipe.sendRequest(this.Enum.Command.AccountService.Account.CREATE, param, null, callback);
};

Account.prototype.login = function(param, callback) {
    param.password = this.pipe.md5(param.password);
    this.pipe.sendRequest(this.Enum.Command.AccountService.Account.LOGIN, param, null, callback);
};

Account.prototype.logout = function(param, callback) {
    this.pipe.sendRequest(this.Enum.Command.AccountService.Account.LOGOUT, param, null, callback);
};

Account.prototype.tokenLogin = function(param, callback) {
    this.pipe.sendRequest(this.Enum.Command.AccountService.Account.TOKEN_LOGIN, param, null, callback);
};

Account.prototype.updateTokenExpiry = function(param, callback) {
    this.pipe.sendRequest(this.Enum.Command.AccountService.Account.UPDATE_TOKEN_EXPIRY, param, null, callback);
};

Account.prototype.newToken = function(param, callback) {
    param.password = this.pipe.md5(param.password);
    this.pipe.sendRequest(this.Enum.Command.AccountService.Account.NEW_TOKEN, param, null, callback);
};

Account.prototype.sessionToken = function(param, callback) {
    this.pipe.sendRequest(this.Enum.Command.AccountService.Account.SESSION_TOKEN, param, null, callback);
};

Account.prototype.resetPasswordMail = function(param, callback) {
    this.pipe.sendRequest(this.Enum.Command.AccountService.Account.RESET_PASSWORD_MAIL, param, null, callback);
};

Account.prototype.resetPassword = function(param, callback) {
    param.newPassword = this.pipe.md5(param.newPassword);
    param.confirmPassword = this.pipe.md5(param.confirmPassword);
    this.pipe.sendRequest(this.Enum.Command.AccountService.Account.RESET_PASSWORD, param, null, callback);
};

Account.prototype.updatePassword = function(param, callback) {
    param.password = this.pipe.md5(param.password);
    param.newPassword = this.pipe.md5(param.newPassword);
    this.pipe.sendRequest(this.Enum.Command.AccountService.Account.UPDATE_PASSWORD, param, null, callback);
};

Account.prototype.userProfile = function(param, avatar, callback) {
    this.pipe.sendRequest(this.Enum.Command.AccountService.Account.USER_PROFILE, param, avatar, callback);
};

Account.prototype.updateProfile = function(param, avatar, callback) {
    this.pipe.sendBlobRequest(this.Enum.Command.AccountService.Account.UPDATE_PROFILE, param, avatar, callback);
};

Account.prototype.setValue = function(param, callback) {
    this.pipe.sendRequest(this.Enum.Command.AccountService.Account.SET_VALUE, param, null, callback);
};

Account.prototype.getValue = function(param, callback) {
    this.pipe.sendRequest(this.Enum.Command.AccountService.Account.GET_VALUE, param, null, callback);
};