# We Are Zion: every page, desktop + phone: errors, every button/toggle, the phone menu, forms.
import os, re, json, hashlib
from playwright.sync_api import sync_playwright
ROOT="/tmp/zt"; BASE="http://localhost:3204/"
pages=sorted(os.path.relpath(os.path.join(d,f),ROOT) for d,_,fs in os.walk(ROOT) if not any(x in d for x in ("/server","/tools")) for f in fs if f.endswith(".html"))
res={"pages":{}, "issues":[]}
with sync_playwright() as p:
    b=p.chromium.launch()
    for vw,size in (("desktop",(1366,900)),("phone",(390,844))):
        ctx=b.new_context(viewport={"width":size[0],"height":size[1]}); pg=ctx.new_page()
        pg.route(re.compile(r"^https?://(?!localhost)"), lambda r: r.abort())   # outside sites are not part of this test
        for path in pages:
            errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)[:140]))
            pg.goto(BASE+path); pg.wait_for_timeout(1200)
            over=pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            if over>2: res["issues"].append(f"{vw} {path}: page scrolls sideways by {over}px")
            btns=pg.query_selector_all("button:visible, [role=button]:visible, summary:visible")
            tried=0; dead=[]
            for i,e in enumerate(btns[:40]):
                try:
                    l=(e.get_attribute("aria-label") or e.inner_text() or e.get_attribute("class") or "").strip()[:40]
                    h1=hashlib.md5(pg.content().encode()).hexdigest(); u=pg.url
                    e.click(timeout=1500, force=False); pg.wait_for_timeout(500); tried+=1
                    if hashlib.md5(pg.content().encode()).hexdigest()==h1 and pg.url==u: dead.append(l)
                    if pg.url!=u: pg.goto(BASE+path); pg.wait_for_timeout(800); btns=pg.query_selector_all("button:visible, [role=button]:visible, summary:visible")
                except Exception: pass
            if dead: res["issues"].append(f"{vw} {path}: buttons with no visible effect: {dead[:6]}")
            if errs: res["issues"].append(f"{vw} {path}: script errors: {errs[:3]}")
            if vw=="phone":
                tog=pg.query_selector("[aria-controls], .nav__toggle, .menu-toggle, button[aria-label*=enu i]")
                if tog:
                    try:
                        pg.goto(BASE+path); pg.wait_for_timeout(800); tog=pg.query_selector("[aria-controls]:visible, button[aria-label*=enu i]:visible")
                        exp0=tog.get_attribute("aria-expanded"); tog.click(); pg.wait_for_timeout(700); exp1=tog.get_attribute("aria-expanded")
                        links=pg.query_selector_all("nav a:visible, [role=dialog] a:visible")
                        if exp0==exp1 and len(links)<3: res["issues"].append(f"phone {path}: menu button did not open the menu")
                    except Exception as ex: res["issues"].append(f"phone {path}: menu test error {str(ex)[:80]}")
            forms=pg.query_selector_all("form")
            res["pages"].setdefault(path,{})[vw]={"buttons_tried":tried,"forms":len(forms)}
            pg.remove_listener("pageerror", pg.listeners("pageerror")[0]) if hasattr(pg,"listeners") else None
        ctx.close()
    b.close()
json.dump(res,open("/home/claude/gt/zclick.json","w"),indent=1)
print("pages", len(pages)); print("\n".join(res["issues"]) or "no issues")
print("forms:", {k:v.get("desktop",{}).get("forms") for k,v in res["pages"].items() if v.get("desktop",{}).get("forms")})
