#!/usr/bin/env python3
"""Prepares a static HTML website for the Elanster CMS (run once, then push the website).

What it does, without changing the design:
  * marks every editable text (headings, paragraphs, list items, links, buttons) with data-cms="key"
  * texts that repeat on most pages (menu, footer) get one shared key, so you edit them once
  * marks article pages (an <article> inside a folder such as blogs/) so the CMS can show the published article
  * adds js/cms-config.js and js/cms-content.js and loads them on every page
  * writes cms-manifest.json, the list of pages and texts the CMS reads

Usage:  python3 prepare-website.py <website folder> [--site SHORT_NAME --url CMS_BACKEND_URL --key WEBSITE_KEY]
Safe to run again: texts that already have data-cms keep their keys.
"""
import argparse, hashlib, html, json, os, re, shutil, sys

TAGS = r"h1|h2|h3|h4|h5|h6|p|li|a|button|figcaption|blockquote|dt|dd|label"
BLOCK = r"div|section|article|ul|ol|h[1-6]|p|li|a|button|img|figure|table|form|header|footer|nav|main|aside|picture|video|iframe|input|select|textarea|blockquote|dl"
ELEMENT = re.compile(r"<(" + TAGS + r")\b([^>]*)>((?:(?!<(?:/?(?:" + BLOCK + r"))\b)[\s\S])*?)</\1\s*>", re.I)
PROTECT = re.compile(r"<(script|style|noscript|svg|template|textarea)\b[\s\S]*?</\1\s*>|<!--[\s\S]*?-->", re.I)
KIT = os.path.dirname(os.path.abspath(__file__))


def text_of(inner):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", inner))).strip()


def worth(text):
    return len(text) >= 2 and re.search(r"[A-Za-z0-9À-￿]", text) is not None


def protect(src):
    store = []
    def keep(m):
        store.append(m.group(0)); return f"\x00{len(store) - 1}\x00"
    return PROTECT.sub(keep, src), store


def restore(src, store):
    return re.sub(r"\x00(\d+)\x00", lambda m: store[int(m.group(1))], src)


def slug_of(rel):
    name = os.path.splitext(os.path.basename(rel))[0].lower()
    return "home" if name == "index" else re.sub(r"[^a-z0-9-]+", "-", name)


def kind(tag):
    tag = tag.lower()
    return "Headings" if tag[0] == "h" else "Links & buttons" if tag in ("a", "button") else "Text"


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("folder"); ap.add_argument("--site", default=""); ap.add_argument("--url", default=""); ap.add_argument("--key", default="")
    a = ap.parse_args(); root = os.path.abspath(a.folder)
    pages = sorted(f for f in os.listdir(root) if f.endswith(".html") and f != "404.html")
    articles = sorted(os.path.join(d, f) for d in os.listdir(root) if os.path.isdir(os.path.join(root, d)) and not d.startswith((".", "assets", "node_modules", "js", "css"))
                      for f in os.listdir(os.path.join(root, d)) if f.endswith(".html") and re.search(r"<article\b", open(os.path.join(root, d, f), encoding="utf-8", errors="ignore").read()))
    if not pages: sys.exit("No .html pages found in " + root)

    # Pass 1: which (tag, text) pairs repeat on most pages → shared header/footer texts.
    seen = {}
    for f in pages:
        body, _ = protect(open(os.path.join(root, f), encoding="utf-8").read())
        for t in {(m.group(1).lower(), text_of(m.group(3))) for m in ELEMENT.finditer(body)}:
            seen[t] = seen.get(t, 0) + 1
    shared = {t for t, n in seen.items() if n >= max(2, round(len(pages) * 0.6)) and worth(t[1])}
    gkey = lambda t: "global." + t[0] + "." + hashlib.sha1(t[1].encode()).hexdigest()[:6]

    manifest = {"pages": [], "global": {"slug": "_global", "title": "Header & footer (every page)", "file": None, "fields": []}}
    gfields = {}

    def tag_file(rel, slug, page_texts=True):
        path = os.path.join(root, rel); src = open(path, encoding="utf-8").read()
        body, store = protect(src); fields = []; n = {"i": 0}
        def mark(m):
            tag, attrs, inner = m.group(1), m.group(2), m.group(3); t = text_of(inner); pair = (tag.lower(), t)
            if not worth(t) or 'aria-hidden="true"' in attrs: return m.group(0)
            old = re.search(r'\sdata-cms="([^"]+)"', attrs)
            if pair in shared: key = old.group(1) if old else gkey(pair); gfields.setdefault(key, {"key": key, "label": t[:60], "group": "Header & footer", "tag": tag.lower(), "text": t})
            elif page_texts:
                n["i"] += 1; key = old.group(1) if old else f"{slug}.{tag.lower()}.{n['i']}"
                fields.append({"key": key, "label": t[:60], "group": kind(tag), "tag": tag.lower(), "text": t})
            else: return m.group(0)
            return m.group(0) if old else f"<{tag}{attrs} data-cms=\"{key}\">{inner}</{tag}>"
        body = ELEMENT.sub(mark, body)
        out = restore(body, store)
        out = re.sub(r"<body\b(?![^>]*data-cms-page)([^>]*)>", lambda m: f'<body{m.group(1)} data-cms-page="{slug}">' if page_texts else m.group(0), out, count=1)
        depth = rel.count("/"); prefix = "../" * depth
        if "cms-content.js" not in out:
            out = re.sub(r"</body>", f'  <script src="{prefix}js/cms-config.js"></script>\n  <script src="{prefix}js/cms-content.js?v=1" defer></script>\n</body>', out, count=1, flags=re.I)
        open(path, "w", encoding="utf-8").write(out)
        return out, fields

    for f in pages:
        slug = slug_of(f); out, fields = tag_file(f, slug)
        title = text_of(re.search(r"<title[^>]*>([\s\S]*?)</title>", out, re.I).group(1)) if re.search(r"<title", out, re.I) else slug
        desc = re.search(r'<meta[^>]+name="description"[^>]+content="([^"]*)"', out, re.I)
        seo = [{"key": f"{slug}.seo.title", "label": "Page title (Google)", "group": "SEO", "tag": "seo-title", "text": title}]
        if desc: seo.append({"key": f"{slug}.seo.description", "label": "Meta description (Google)", "group": "SEO", "tag": "seo-description", "text": html.unescape(desc.group(1))})
        name = "Home" if slug == "home" else re.split(r"\s[|–—-]\s", title)[0].strip() or slug
        manifest["pages"].append({"slug": slug, "title": name, "file": f, "fields": seo + fields})
        print(f"  {f:34} {len(fields):4} texts")

    for rel in articles:   # article pages: shared texts + the article itself comes from the CMS
        path = os.path.join(root, rel); src = open(path, encoding="utf-8").read(); aslug = slug_of(rel)
        if "data-cms-article" not in src:
            src = re.sub(r"<article\b([^>]*)>", lambda m: f'<article{m.group(1)} data-cms-article="{aslug}">', src, count=1)
            src = re.sub(r"<h1\b(?![^>]*data-cms-title)([^>]*)>", lambda m: f"<h1{m.group(1)} data-cms-title>", src, count=1)
            open(path, "w", encoding="utf-8").write(src)
        tag_file(rel, aslug, page_texts=False)
    print(f"  {len(articles)} article pages linked to CMS articles")

    manifest["global"]["fields"] = list(gfields.values())
    json.dump(manifest, open(os.path.join(root, "cms-manifest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    os.makedirs(os.path.join(root, "js"), exist_ok=True)
    shutil.copy(os.path.join(KIT, "cms-content.js"), os.path.join(root, "js", "cms-content.js"))
    cfg = os.path.join(root, "js", "cms-config.js")
    if a.url or not os.path.exists(cfg):
        open(cfg, "w", encoding="utf-8").write(open(os.path.join(KIT, "cms-config.js"), encoding="utf-8").read().replace(
            'url: "", site: "", key: ""', f'url: "{a.url}", site: "{a.site}", key: "{a.key}"'))
    print(f"Done: {len(pages)} pages, {len(gfields)} shared header/footer texts. Wrote cms-manifest.json, js/cms-config.js, js/cms-content.js")


if __name__ == "__main__":
    main()
