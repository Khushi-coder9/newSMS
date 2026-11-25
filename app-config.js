/**
 * Shared API origin for browser, Capacitor, and local Node.
 * Live site: https://studentmindsupport.duckdns.org (EC2 100.31.107.145)
 */
(function (w) {
  var LIVE_ORIGIN = 'https://studentmindsupport.duckdns.org';
  var native = false;
  try {
    native = !!(w.Capacitor && typeof w.Capacitor.isNativePlatform === 'function' && w.Capacitor.isNativePlatform());
  } catch (e) {}
  var host = w.location.hostname;
  var port = String(w.location.port || '');
  var capacitorScheme = w.location.protocol === 'capacitor:' || w.location.protocol === 'ionic:';
  var localDev = !native && !capacitorScheme && (host === 'localhost' || host === '127.0.0.1') && port !== '' && port !== '80' && port !== '443';

  w.SMS_LIVE_ORIGIN = LIVE_ORIGIN;
  w.SMS_API_BASE = localDev
    ? 'http://localhost:5000/api'
    : ((native || capacitorScheme) ? LIVE_ORIGIN + '/api' : '/api');
})(window);
