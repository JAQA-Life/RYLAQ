/*
 * JAQA startup diagnostics. Loaded before the app. If the workspace fails to
 * start, the #jaqa-boot screen stays visible and this script says why, instead
 * of leaving a blank page. It only changes text on the page: it stores
 * nothing, sends nothing and logs nothing. The app removes #jaqa-boot once it
 * has fully started, and from then on this script does nothing.
 * JAQA™ is a trademark of JAQA. © JAQA™. All rights reserved.
 */
(function () {
  'use strict';
  function pending() {
    return document.getElementById('jaqa-boot');
  }
  function say(text) {
    var box = pending();
    var msg = document.getElementById('jaqa-boot-msg');
    if (!box || !msg) return;
    box.setAttribute('data-state', 'error');
    msg.textContent = text;
  }
  // A Content-Security-Policy that does not allow the app's own script.
  window.addEventListener('securitypolicyviolation', function (e) {
    var d = String(e.effectiveDirective || e.violatedDirective || '');
    if (!pending() || d.indexOf('script-src') !== 0) return;
    say('Your browser blocked the app script because of a Content-Security-Policy rule (' + d + '). This usually means an old .htaccess file, or a server, cache or CDN setting, is still active. Follow the steps below.');
  });
  // A missing file (script or stylesheet), or an error while the app starts.
  window.addEventListener(
    'error',
    function (e) {
      if (!pending()) return;
      var t = e.target;
      if (t && t.tagName === 'SCRIPT') say('The app script could not be loaded (' + t.getAttribute('src') + '). Make sure the assets folder was uploaded next to index.html.');
      else if (t && t.tagName === 'LINK') say('The stylesheet could not be loaded (' + t.getAttribute('href') + '). Make sure the assets folder was uploaded next to index.html.');
      else if (e.message) say('The app stopped while starting: ' + e.message + '. Reload with Ctrl+Shift+R. If this stays, upload the latest jaqa-web.zip again.');
    },
    true
  );
  // Nothing reported, but the app still has not started (for example, a
  // script blocked by an extension or a proxy that rewrote it).
  window.addEventListener('load', function () {
    setTimeout(function () {
      var box = pending();
      if (box && box.getAttribute('data-state') !== 'error') say('The app script did not start. Follow the steps below, then reload with Ctrl+Shift+R.');
    }, 4000);
  });
})();
