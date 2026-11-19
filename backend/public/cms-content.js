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
  // Same kinds of text the CMS reads from the page (backend/src/lib/pagetexts.ts).
  var TAGS = "h1,h2,h3,h4,h5,h6,p,li,a,button,figcaption,blockquote,dt,dd,label,summary,span,b,strong,em,small,div,td,th,cite,q,mark,u,s,sup,sub";
  var letters = /\p{L}/u;
  // The visible wording of an element: line breaks count as a space, scripts and icons count as nothing.
  function txt(el) {
    var out = ""; (function walk(n) { n.childNodes.forEach(function (c) {
      if (c.nodeType === 3) out += c.nodeValue;
      else if (c.nodeType === 1) { var t = c.tagName; if (t === "BR") out += " ";
        else if (!/^(SCRIPT|STYLE|SVG|svg|NOSCRIPT|TEMPLATE)$/.test(t) && letters.test(c.textContent || "")) walk(c); }   // counters and icons are not wording
    }); })(el);
    return norm(out);
  }
  var norm = function (s) { return String(s).replace(/\s+/g, " ").trim(); };
  var ready = function (fn) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn); else fn(); };

  /* Replace the words but keep icons and arrows (children without letters, e.g. an arrow in a button).
     Text the website split into one piece per word for an animation is rebuilt as one text, so it is never half-changed. */
  function setText(el, text) {
    if (txt(el) === norm(text)) return;
    var placed = false, all = el.textContent || "";
    var lead = /^\s*/.exec(all)[0], trail = /\s*$/.exec(all)[0];   // keep spacing such as "&nbsp;— average go-live"
    var node = document.createTextNode(lead + text + (trail === all ? "" : trail));
    Array.prototype.slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeType === 1 && n.tagName !== "BR" && !letters.test(n.textContent || "")) return;   // icon / arrow: keep
      if (!placed) { el.insertBefore(node, n); placed = true; }
      el.removeChild(n);
    });
    if (!placed) el.appendChild(node);
  }
  function metaSet(sel, v) { var m = document.querySelector(sel); if (m) m.setAttribute("content", v); }
  /* Websites without data-cms markers: find each text by its original wording and mark it, so it can be changed. */
  function tag(original) {
    if (!original || !document.body) return;
    var want = {};
    Object.keys(original).forEach(function (k) {
      if (/\.img\./.test(k)) { tagImage(k, original[k]); return; }
      if (/\.seo\./.test(k) || document.querySelector('[data-cms="' + k.replace(/"/g, "") + '"]')) return;
      var t = norm(original[k]); if (t) (want[t] = want[t] || []).push(k);
    });
    var max = Object.keys(want).reduce(function (m, t) { return Math.max(m, t.length); }, 0) + 400;
    if (max === 400) return;
    document.querySelectorAll(TAGS).forEach(function (el) {
      if (el.hasAttribute("data-cms") || (el.textContent || "").length > max || el.closest("script,style,svg")) return;
      var t = txt(el), keys = want[t]; if (!keys) return;
      var tagName = el.tagName.toLowerCase();
      var key = keys.filter(function (k) { return k.split(".")[1] === tagName; })[0] || keys[0];
      // Use the innermost element holding exactly this text.
      var inner = Array.prototype.some.call(el.querySelectorAll(TAGS), function (c) { return txt(c) === t; });
      if (!inner) el.setAttribute("data-cms", key);
    });
  }
  /* Pictures: found by their original address, swapped for the one chosen in the CMS. */
  function tagImage(key, src) {
    if (!src || document.querySelector('[data-cms-img="' + key.replace(/"/g, "") + '"]')) return;
    document.querySelectorAll("img").forEach(function (im) {
      if (!im.hasAttribute("data-cms-img") && (im.getAttribute("src") === src || im.getAttribute("data-src") === src)) im.setAttribute("data-cms-img", key);
    });
  }
  // A picture uploaded to the CMS is always loaded from the CMS's own address.
  function media(v) { return cfg.url ? String(v).replace(/^(?:https?:\/\/[^/]+)?\/api\/v1\/media\//, cfg.url.replace(/\/$/, "") + "/api/v1/media/") : v; }
  function setImage(im, v) {
    var u = media(v); if (im.getAttribute("src") === u) return;
    im.removeAttribute("srcset"); im.removeAttribute("data-srcset"); if (im.hasAttribute("data-src")) im.setAttribute("data-src", u);
    var pic = im.closest("picture"); if (pic) pic.querySelectorAll("source").forEach(function (so) { so.remove(); });
    im.setAttribute("src", u); im.style.visibility = ""; im.style.opacity = "";   // undo any "broken picture" hiding from before
    Array.prototype.slice.call(im.classList).forEach(function (c) { if (/broken|error|fail/i.test(c)) im.classList.remove(c); });
  }
  function apply(values) {
    Object.keys(values).forEach(function (key) {
      var v = values[key];
      if (/\.seo\.title$/.test(key)) { if (key === slug + ".seo.title") { document.title = v; metaSet('meta[property="og:title"]', v); } return; }
      if (/\.seo\.description$/.test(key)) { if (key === slug + ".seo.description") { metaSet('meta[name="description"]', v); metaSet('meta[property="og:description"]', v); } return; }
      if (/\.img\./.test(key)) { document.querySelectorAll('[data-cms-img="' + key.replace(/"/g, "") + '"]').forEach(function (im) { setImage(im, v); }); return; }
      document.querySelectorAll('[data-cms="' + key.replace(/"/g, "") + '"]').forEach(function (el) { setText(el, v); });
    });
  }

  /* Preview inside the CMS editor: click a text to select it; changes show while typing. */
  if (/[?&]cms-edit=1/.test(location.search) && window.parent !== window) {
    var st = document.createElement("style");
    st.textContent = "[data-cms],[data-cms-img]{cursor:pointer}[data-cms]:hover,[data-cms-img]:hover{outline:2px dashed #f26f2c;outline-offset:3px}.cms-active{outline:2px solid #f26f2c!important;outline-offset:3px;background:rgba(242,111,44,.1)}[data-reveal],.reveal{opacity:1!important;transform:none!important}[data-split] *{transform:none!important;opacity:1!important}";
    document.head.appendChild(st);
    var post = function (m) { m.source = "elanster-site"; window.parent.postMessage(m, "*"); };
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("[data-cms],[data-cms-img]");
      if (e.target.closest && e.target.closest("a,button,summary")) e.preventDefault();
      if (!t) return; e.preventDefault(); e.stopPropagation(); post({ type: "select", key: t.getAttribute("data-cms") || t.getAttribute("data-cms-img") });
    }, true);
    window.addEventListener("message", function (e) {
      var d = e.data; if (!d || d.source !== "elanster-cms") return;
      if (d.type === "values") { tag(d.original); apply(d.values); }
      if (d.type === "focus") {
        document.querySelectorAll(".cms-active").forEach(function (x) { x.classList.remove("cms-active"); });
        var q = String(d.key).replace(/"/g, ""), el = document.querySelector('[data-cms="' + q + '"],[data-cms-img="' + q + '"]');
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
  /* Article pages: show the article as published in the CMS (title, text, picture, contents list).
     A new article written in the CMS has no page of its own on a static website, so it opens on an existing
     article page with ?article=its-slug and that page shows it instead. */
  var wanted = (/[?&]article=([^&#]+)/.exec(location.search) || [])[1];
  function fmtDate(d) { try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch (e) { return ""; } }
  ready(function () {
    var body = document.querySelector("[data-cms-article]");
    if (!body && /\/[^/]+\/[^/]+$/.test(location.pathname)) body = document.querySelector("article");   // e.g. /blogs/my-post.html
    if (!body) return;
    var h = document.querySelector("[data-cms-title]") || body.querySelector("h1") || document.querySelector("h1");
    var aslug = wanted ? decodeURIComponent(wanted) : body.getAttribute("data-cms-article") || (location.pathname.split("/").pop() || "").replace(/\.html?$/, "");
    if (wanted) body.style.visibility = "hidden";   // do not flash the other article's text first
    api("/blogs/" + encodeURIComponent(aslug)).then(function (a) {
      body.style.visibility = "";
      if (!a || !a.content) return;
      body.innerHTML = a.content;
      if (h && a.title) setText(h, a.title);
      if (a.seo && a.seo.title) { document.title = a.seo.title; metaSet('meta[property="og:title"]', a.seo.title); }
      if (a.seo && a.seo.description) { metaSet('meta[name="description"]', a.seo.description); metaSet('meta[property="og:description"]', a.seo.description); }
      // Cover picture: the marked one, or the first picture between the title and the article text.
      var cover = document.querySelector("[data-cms-cover]");
      if (!cover && h) { var imgs = document.querySelectorAll("img"); for (var i = 0; i < imgs.length; i++) {
        var im = imgs[i]; if (body.contains(im)) break;
        if (h.compareDocumentPosition(im) & Node.DOCUMENT_POSITION_FOLLOWING && im.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING) { cover = im; break; } } }
      if (cover && a.featuredImage && a.featuredImage.url) { setImage(cover, a.featuredImage.url); if (a.featuredImage.alt) cover.alt = a.featuredImage.alt; }
      // Date / reading time / author line right under the title.
      var meta = h && h.nextElementSibling;
      if (wanted && meta && /\b(19|20)\d\d\b|min read/i.test(meta.textContent || "")) {
        var words = (body.textContent || "").split(/\s+/).length;
        meta.textContent = [fmtDate(a.publishedAt), Math.max(1, Math.round(words / 200)) + " min read", a.author ? "By " + a.author : ""].filter(Boolean).join(" · ");
      }
      // "In this article" list: rebuilt from the article's own headings.
      var toc = Array.prototype.filter.call(document.querySelectorAll("nav,ul,ol"), function (n) {
        var ls = n.querySelectorAll("a"), sec = body.closest("section,main") || document.body;
        return !body.contains(n) && sec.contains(n) && !n.closest("header,footer") && ls.length && Array.prototype.every.call(ls, function (x) { return /^#/.test(x.getAttribute("href") || ""); });
      })[0];
      if (toc) {
        var heads = body.querySelectorAll("h2,h3"), tpl = toc.querySelector("a");
        Array.prototype.slice.call(toc.querySelectorAll("a")).forEach(function (x) { (x.parentElement !== toc && x.parentElement.tagName === "LI" ? x.parentElement : x).remove(); });
        if (!heads.length) toc.style.display = "none";
        heads.forEach(function (hd, i) { if (!hd.id) hd.id = "h" + i; var l = tpl.cloneNode(false); l.setAttribute("href", "#" + hd.id); l.textContent = hd.textContent;
          if (/^(UL|OL)$/.test(toc.tagName)) { var li = document.createElement("li"); li.appendChild(l); toc.appendChild(li); } else toc.appendChild(l); });
      }
    });
  });

  /* Article lists (blog page, "keep reading"): articles published in the CMS that the page does not show yet
     are added as copies of the first card in the list, newest first. */
  var cardSlug = function (a) { var m = /(?:^|\/)([^/?#]+?)\.html?(?:[?#]|$)/.exec(a.getAttribute("href") || ""); var q = /[?&]article=([^&#]+)/.exec(a.getAttribute("href") || "");
    return q ? decodeURIComponent(q[1]) : m && /\//.test(a.getAttribute("href")) ? m[1] : null; };
  ready(function () {
    var cards = Array.prototype.filter.call(document.querySelectorAll("a[href]"), function (a) { return cardSlug(a) && a.querySelector("h1,h2,h3,h4") && !a.closest("header,nav,footer"); });
    if (!cards.length) return;
    api("/blogs?limit=50").then(function (d) {
      if (!d || !d.items) return;
      var onPage = {}; cards.forEach(function (c) { onPage[cardSlug(c)] = true; });
      var known = d.items.filter(function (x) { return onPage[x.slug]; }).length;
      if (!known) return;   // these cards are not this website's articles
      var missing = d.items.filter(function (x) { return !onPage[x.slug]; });
      var lists = []; cards.forEach(function (c) { var p = c.parentElement; if (lists.indexOf(p) < 0 && p.querySelectorAll(":scope > a[href]").length >= 2) lists.push(p); });
      lists.forEach(function (list) {
        var own = Array.prototype.filter.call(list.children, function (c) { return cards.indexOf(c) >= 0; });
        var full = own.length >= known - 1;   // the full article list; otherwise a short "keep reading" list keeps its size
        var add = full ? missing : missing.slice(0, own.length);
        add.slice().reverse().forEach(function (x) {
          var tpl = own[0], c = tpl.cloneNode(true), href = tpl.getAttribute("href").replace(/[?#].*$/, "");
          c.setAttribute("href", href + "?article=" + encodeURIComponent(x.slug));
          c.removeAttribute("data-reveal"); c.style.opacity = "1"; c.style.transform = "none";
          c.querySelectorAll("[data-reveal]").forEach(function (n) { n.removeAttribute("data-reveal"); n.style.opacity = "1"; n.style.transform = "none"; });
          var hd = c.querySelector("h1,h2,h3,h4"); if (hd) hd.textContent = x.title;
          var p = c.querySelector("p"); if (p) p.textContent = x.excerpt || "";
          var im = c.querySelector("img"); if (im) { if (x.featuredImage && x.featuredImage.url) { setImage(im, x.featuredImage.url); im.alt = x.featuredImage.alt || x.title; } else im.style.visibility = "hidden"; }
          Array.prototype.forEach.call(c.querySelectorAll("span,small,time"), function (n) {
            if (n.children.length && !n.querySelector("i,svg")) return;
            var t = (n.textContent || "").trim();
            if (/\b(19|20)\d\d\b/.test(t)) n.textContent = fmtDate(x.publishedAt);
            else if (/^By\s/i.test(t)) { var icon = n.querySelector("i,svg"); n.textContent = x.author ? "By " + x.author + " " : ""; if (icon && x.author) n.appendChild(icon); }
          });
          list.insertBefore(c, list.firstElementChild);
          if (!full && list.lastElementChild !== c) list.removeChild(own.pop());
        });
      });
    });
  });
})();
