# Every page of the We Are Zion copy: every internal link, picture, script and style must exist.
import os, re, html, urllib.parse
ROOT="/tmp/zt"; pages=[]
for d,_,fs in os.walk(ROOT):
    if any(x in d for x in ("/server","/tools","/node_modules","/.git")): continue
    for f in fs:
        if f.endswith(".html"): pages.append(os.path.relpath(os.path.join(d,f),ROOT))
broken={}; total=0; ext=set()
for p in sorted(pages):
    src=open(os.path.join(ROOT,p),encoding="utf8").read()
    for attr,url in re.findall(r'\s(href|src)=["\']([^"\']+)["\']', src):
        url=html.unescape(url).strip()
        if url.startswith(("http:","https:","//")): ext.add(url.split("/")[2] if "//" in url else url); continue
        if url.startswith(("#","mailto:","tel:","javascript:","data:")) or "${" in url or "{{" in url: continue
        total+=1
        path=urllib.parse.urlparse(url).path
        target=os.path.normpath(os.path.join(ROOT, path.lstrip("/")) if path.startswith("/") else os.path.join(ROOT,os.path.dirname(p),path))
        ok=os.path.exists(target) or os.path.exists(target+".html") or os.path.exists(os.path.join(target,"index.html"))
        if not ok: broken.setdefault(p,[]).append(url)
print(f"pages: {len(pages)}  internal links/files checked: {total}")
for p,l in broken.items(): print("BROKEN in", p, ":", sorted(set(l))[:8])
print("external hosts:", sorted(ext)[:20])
