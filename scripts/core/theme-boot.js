// Runs before the page paints: applies the saved theme and language so nothing flashes.
(function () {
  var root = document.documentElement;
  try {
    var theme = JSON.parse(localStorage.getItem('sl:theme') || 'null');
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
    var lang = JSON.parse(localStorage.getItem('sl:lang') || 'null');
    if (lang !== 'en' && lang !== 'hy') {
      var prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
      lang = prefs.some(function (l) { return /^hy\b/i.test(l || ''); }) ? 'hy' : 'en';
    }
    root.setAttribute('lang', lang);
  } catch (e) { /* storage unavailable */ }

  // Browsers block ES modules on file:// pages, so explain how to start the server instead of showing a blank page.
  if (location.protocol === 'file:') {
    document.addEventListener('DOMContentLoaded', function () {
      var box = document.createElement('div');
      box.className = 'file-warning';
      box.setAttribute('role', 'alert');
      [
        'This site must be opened through the local server.',
        'Windows: double-click start.bat. Any system with Node.js: run "node server.js" in the project folder.',
        'Then open http://localhost:3000',
      ].forEach(function (text) {
        var p = document.createElement('p');
        p.textContent = text;
        box.appendChild(p);
      });
      document.body.prepend(box);
    });
  }
})();
