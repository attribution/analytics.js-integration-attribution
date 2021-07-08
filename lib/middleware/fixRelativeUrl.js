'use strict';

function FixRelativeUrl({ payload, next, integrations }) {
  try {
    // append origin if page url begins with '/'
    if (payload.obj.context.page.url.charAt(0) == '/') {
      payload.obj.context.page.url = window.location.origin + payload.obj.context.page.url;
    }
    if (payload.obj.properties.url.charAt(0) == '/') {
      payload.obj.properties.url = window.location.origin + payload.obj.properties.url;
    }
  } catch (e) {
    // console.error(e);
  } finally {
    // console.warn(payload.obj)
    next(payload);
  }
}

module.exports = FixRelativeUrl;
