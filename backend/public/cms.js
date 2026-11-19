/* Elanster CMS - one-line connector. Paste in <head>:
   <script src="https://YOUR-CMS/cms.js" data-key="ek_live_..." defer></script>
   The key says which website it is; nothing else is needed. If the CMS is unreachable the page stays as it is. */
(function () {
  "use strict";
  var me = document.currentScript || document.querySelector('script[src*="cms.js"][data-key]');
  if (!me) return;
  var key = me.getAttribute("data-key"), base = me.src.replace(/\/cms\.js(\?.*)?$/, "");
  if (!key) return;
  var cacheKey = "cms-site:" + key.slice(0, 16);
  function start(site) {
    window.ELANSTER_CMS = { url: base, site: site, key: key };
    var s = document.createElement("script"); s.src = base + "/cms-content.js?v=1"; document.head.appendChild(s);
  }
  var cached = null; try { cached = localStorage.getItem(cacheKey); } catch (e) { /* private mode */ }
  if (cached) start(cached);
  fetch(base + "/api/v1/websites", { headers: { "X-API-Key": key } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (l) {
      if (!l || !l[0]) return;
      try { localStorage.setItem(cacheKey, l[0].slug); } catch (e) { /* ignore */ }
      if (!cached) start(l[0].slug);
    }).catch(function () { /* keep the page as it is */ });
})();
