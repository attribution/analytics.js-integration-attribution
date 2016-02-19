
/**
 * Module dependencies.
 */

var clone = require('clone');
var cookie = require('cookie');
var extend = require('extend');
var integration = require('segmentio/analytics.js-integration@1.0.1');
var json = require('segmentio/json@1.0.0');
var localstorage = require('store');
var protocol = require('segmentio/protocol');
var send = require('yields/send-json');
var topDomain = require('top-domain');
var uuid = require('uuid');
var encode = require('ForbesLindesay/base64-encode');
var cors = require('has-cors');

/**
 * Cookie options
 */

var cookieOptions = {
  // 1 year
  maxage: 31536000000,
  secure: false,
  path: '/'
};

/**
 * Expose `Attribution` integration.
 */

var Attribution = exports = module.exports = integration('Attribution')
  .option('project', '');

/**
 * Get the store.
 *
 * @return {Function}
 */

exports.storage = function() {
  return protocol() === 'file:' || protocol() === 'chrome-extension:' ? localstorage : cookie;
};

/**
 * Expose global for testing.
 */

exports.global = window;

/**
 * Initialize.
 *
 * https://github.com/segmentio/segmentio/blob/master/modules/segmentjs/segment.js/v1/segment.js
 *
 * @api public
 */

Attribution.prototype.initialize = function() {
  var self = this;
  this.ready();
  this.analytics.on('invoke', function(msg) {
    var action = msg.action();
    var listener = 'on' + msg.action();
    self.debug('%s %o', action, msg);
    if (self[listener]) self[listener](msg);
    self.ready();
  });
};

/**
 * Loaded.
 *
 * @api private
 * @return {boolean}
 */

Attribution.prototype.loaded = function() {
  return true;
};

/**
 * Page.
 *
 * @api public
 * @param {Page} page
 */

Attribution.prototype.onpage = function(page) {
  if(page.obj.event === undefined)
    page.obj.event = page.event();
  this.send('/track', page.json());
};

/**
 * Identify.
 *
 * @api public
 * @param {Identify} identify
 */

Attribution.prototype.onidentify = function(identify) {
  this.send('/identify', identify.json());
};

/**
 * ontrack.
 *
 * TODO: Document this.
 *
 * @api private
 * @param {Track} track
 */

Attribution.prototype.ontrack = function(track) {
  this.send('/track', track.json());
};

/**
 * Alias.
 *
 * @api public
 * @param {Alias} alias
 */

Attribution.prototype.onalias = function(alias) {
  var json = alias.json();
  var user = this.analytics.user();
  json.previousId = json.previous_id = json.previousId || json.from || user.id() || user.anonymousId();
  json.userId = json.userId || json.to;
  delete json.from;
  delete json.to;
  this.send('/alias', json);
};

/**
 * Normalize the given `msg`.
 *
 * @api private
 * @param {Object} msg
 */

Attribution.prototype.normalize = function(msg) {
  this.debug('normalize %o', msg);
  var user = this.analytics.user();
  var global = exports.global;
  var query = global.location.search;
  var ctx = msg.context = msg.context || msg.options || {};
  delete msg.options;
  ctx.userAgent = navigator.userAgent;
  msg.userId = msg.user_id = msg.userId || user.id();
  msg.anonymousId = msg.cookie_id = user.anonymousId();
  msg.messageId = uuid();
  msg.sentAt = new Date();
  this.debug('normalized %o', msg);
  return msg;
};

/**
 * Send `obj` to `path`.
 *
 * @api private
 * @param {string} path
 * @param {Object} obj
 * @param {Function} fn
 */

Attribution.prototype.send = function(path, msg, fn) {
  // If sending from GTM appspot IFrame, don't send
  if(global.location.href.search('gtm-msr.appspot.com') !== -1) return;

  var url = scheme() + '//track.attributionapp.com' + path;
  var projectId = this.options.project || window.Attribution.projectId;

  // If we're POSTing, let's send the project_id in the params
  // only on POST though, or else we'll get two question marks
  if(cors)
    url += "?project_id=" + projectId;

  // If we're JSONPing, let's send it in the encoded params
  msg.project_id = projectId;

  fn = fn || noop;
  var self = this;

  msg = this.normalize(msg);

  send(url, msg, function(err, res) {
    self.debug('sent %O, received %O', msg, arguments);
    if (err) return fn(err);
    res.url = url;
    fn(null, res);
  });
};

/**
 * Gets/sets cookies on the appropriate domain.
 *
 * @api private
 * @param {string} name
 * @param {*} val
 */

Attribution.prototype.cookie = function(name, val) {
  var store = Attribution.storage();
  if (arguments.length === 1) return store(name);
  var global = exports.global;
  var href = global.location.href;
  var domain = '.' + topDomain(href);
  if (domain === '.') domain = '';
  this.debug('store domain %s -> %s', href, domain);
  var opts = clone(cookieOptions);
  opts.domain = domain;
  this.debug('store %s, %s, %o', name, val, opts);
  store(name, val, opts);
  if (store(name)) return;
  delete opts.domain;
  this.debug('fallback store %s, %s, %o', name, val, opts);
  store(name, val, opts);
};

/**
 * Get the scheme.
 *
 * The function returns `http:`
 * if the protocol is `http:` and
 * `https:` for other protocols.
 *
 * @api private
 * @return {string}
 */

function scheme() {
  return protocol() === 'http:' ? 'http:' : 'https:';
}

/**
 * Noop.
 */

function noop() {}
