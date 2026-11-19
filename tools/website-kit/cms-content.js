/* Elanster CMS connection (website kit).
   The page design stays in the HTML. Texts marked data-cms="key" are replaced by the text published in the CMS,
   and article pages (marked data-cms-article) show the article published in the CMS.
   If the CMS cannot be reached, the text already in the HTML stays, so the website never breaks. */
(function () {
  "use strict";
  var cfg = window.ELANSTER_CMS || {};
  var pathSlug = function () {
    var f = location.pathname.replace(/^\/+/, "").replace(/\/$/, "").replace(/\.html?$/, "").replace(/\/index$/, "");
    return !f || f === "index" ? "home" : f.replace(/\//g, "-");
  };
  var slug = (document.body && document.body.getAttribute("data-cms-page")) || pathSlug();
  var TAGS = "h1,h2,h3,h4,h5,h6,p,li,a,button,figcaption,blockquote,dt,dd,label";
  var norm = function (s) { return String(s).replace(/\s+/g, " ").trim(); };
  var ready = function (fn) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn); else fn(); };

  // Replace the words but keep icons and other small elements inside (e.g. an arrow icon in a button).
  function setText(el, text) {
    if (norm(el.textContent) === norm(text)) return;
    var kids = Array.prototype.some.call(el.childNodes, function (n) { return n.nodeType === 1 && !/^(BR)$/.test(n.tagName); });
    if (!kids) { el.textContent = text; return; }
    var texts = []; (function walk(n) { n.childNodes.forEach(function (c) { if (c.nodeType === 3) texts.push(c); else if (c.nodeType === 1 && !/^(I|SVG|IMG)$/.test(c.tagName)) walk(c); }); })(el);
    var main = texts.filter(function (t) { return norm(t.nodeValue); }).sort(function (a, b) { return norm(b.nodeValue).length - norm(a.nodeValue).length; })[0];
    if (!main) { el.textContent = text; return; }
    texts.forEach(function (t) { if (t !== main && norm(t.nodeValue)) t.nodeValue = " "; });
    var lead = /^\s*/.exec(main.nodeValue)[0], trail = /\s*$/.exec(main.nodeValue)[0]; main.nodeValue = lead + text + trail;
  }
  function metaSet(sel, v) { var m = document.querySelector(sel); if (m) m.setAttribute("content", v); }
  /* Websites without data-cms markers: find each text by its original wording and mark it, so it can be changed. */
  function tag(original) {
    if (!original || !document.body) return;
    var want = {};
    Object.keys(original).forEach(function (k) {
      if (/\.seo\./.test(k) || document.querySelector('[data-cms="' + k.replace(/"/g, "") + '"]')) return;
      var t = norm(original[k]); if (t) (want[t] = want[t] || []).push(k);
    });
    if (!Object.keys(want).length) return;
    document.querySelectorAll(TAGS).forEach(function (el) {
      if (el.hasAttribute("data-cms") || el.closest("script,style,svg")) return;
      var keys = want[norm(el.textContent)]; if (!keys) return;
      var tagName = el.tagName.toLowerCase();
      var key = keys.filter(function (k) { return k.split(".")[1] === tagName; })[0] || keys[0];
      // Use the innermost element holding exactly this text.
      var inner = Array.prototype.some.call(el.querySelectorAll(TAGS), function (c) { return norm(c.textContent) === norm(el.textContent); });
      if (!inner) el.setAttribute("data-cms", key);
    });
  }
  function apply(values) {
    Object.keys(values).forEach(function (key) {
      var v = values[key];
      if (/\.seo\.title$/.test(key)) { if (key === slug + ".seo.title") { document.title = v; metaSet('meta[property="og:title"]', v); } return; }
      if (/\.seo\.description$/.test(key)) { if (key === slug + ".seo.description") { metaSet('meta[name="description"]', v); metaSet('meta[property="og:description"]', v); } return; }
      document.querySelectorAll('[data-cms="' + key.replace(/"/g, "") + '"]').forEach(function (el) { setText(el, v); });
    });
  }

  /* Preview inside the CMS editor: click a text to select it; changes show while typing. */
  if (/[?&]cms-edit=1/.test(location.search) && window.parent !== window) {
    var st = document.createElement("style");
    st.textContent = "[data-cms]{cursor:pointer}[data-cms]:hover{outline:2px dashed #f26f2c;outline-offset:3px}.cms-active{outline:2px solid #f26f2c!important;outline-offset:3px;background:rgba(242,111,44,.1)}[data-reveal],.reveal{opacity:1!important;transform:none!important}";
    document.head.appendChild(st);
    var post = function (m) { m.source = "elanster-site"; window.parent.postMessage(m, "*"); };
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("[data-cms]");
      if (e.target.closest && e.target.closest("a,button,summary")) e.preventDefault();
      if (!t) return; e.preventDefault(); e.stopPropagation(); post({ type: "select", key: t.getAttribute("data-cms") });
    }, true);
    window.addEventListener("message", function (e) {
      var d = e.data; if (!d || d.source !== "elanster-cms") return;
      if (d.type === "values") { tag(d.original); apply(d.values); }
      if (d.type === "focus") {
        document.querySelectorAll(".cms-active").forEach(function (x) { x.classList.remove("cms-active"); });
        var el = document.querySelector('[data-cms="' + String(d.key).replace(/"/g, "") + '"]');
        if (el) { el.classList.add("cms-active"); el.scrollIntoView({ block: "center", behavior: "smooth" }); }
      }
    });
    var hello = function () { setTimeout(function () { post({ type: "ready", slug: slug }); }, 500); };
    if (document.readyState === "complete") hello(); else window.addEventListener("load", hello);
    return;
  }

  /* Live website */
  if (!cfg.url || !cfg.key || !cfg.site) return;
  var api = function (path) {
    return fetch(cfg.url + "/api/v1/websites/" + cfg.site + path, { headers: { "X-API-Key": cfg.key } })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  };
  {
    var cacheKey = "cms:" + cfg.site + ":" + (slug || "_global");   // menu & footer texts apply on every page, articles included
    // Applied again after the page's own scripts finish, for menus or sections they build or copy.
    var show = function (c) { var go = function () { tag(c.original); apply(c.fields); };
      ready(go); window.addEventListener("load", function () { setTimeout(go, 800); }); setTimeout(go, 2500); };
    try { var c = JSON.parse(localStorage.getItem(cacheKey) || "null"); if (c && c.fields) show(c); } catch (e) { /* private mode */ }
    Promise.all([slug ? api("/pages/" + slug) : Promise.resolve(null), api("/pages/_global")]).then(function (r) {
      var all = { fields: {}, original: {} };
      r.forEach(function (p) { if (!p) return;
        if (p.fields) Object.keys(p.fields).forEach(function (k) { all.fields[k] = p.fields[k]; });
        if (p.original) Object.keys(p.original).forEach(function (k) { if (k in all.fields) all.original[k] = p.original[k]; }); });
      try { localStorage.setItem(cacheKey, JSON.stringify(all)); } catch (e) { /* ignore */ }
      show(all);
    });
  }
  // Article pages: show the article as published in the CMS (title, text, picture).
  ready(function () {
    var body = document.querySelector("[data-cms-article]");
    if (!body && /\/[^/]+\/[^/]+$/.test(location.pathname)) {   // an <article> on a page inside a folder, e.g. /blogs/my-post.html
      body = document.querySelector("article");
      if (body) { var h = body.querySelector("h1") || document.querySelector("h1"); if (h) h.setAttribute("data-cms-title", ""); }
    }
    if (!body) return;
    var aslug = body.getAttribute("data-cms-article") || (location.pathname.split("/").pop() || "").replace(/\.html?$/, "");
    api("/blogs/" + encodeURIComponent(aslug)).then(function (a) {
      if (!a || !a.content) return;
      body.innerHTML = a.content;
      var t = document.querySelector("[data-cms-title]"); if (t && a.title) setText(t, a.title);
      if (a.seo && a.seo.title) document.title = a.seo.title;
      var img = document.querySelector("[data-cms-cover]"); if (img && a.featuredImage && a.featuredImage.url) { img.removeAttribute("srcset"); img.src = a.featuredImage.url; }
    });
  });
})();
