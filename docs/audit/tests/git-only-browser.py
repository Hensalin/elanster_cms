import json
from playwright.sync_api import sync_playwright
info=json.load(open("/home/claude/gt/gitonly.json"))
ok=0; bad=0
def check(c,m):
    global ok,bad
    if c: ok+=1
    else: bad+=1; print("FAIL",m)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page()
    reqs=[]; pg.on("request", lambda r: reqs.append(r.url) if "localhost:3101" in r.url else None)
    for u in ["http://localhost:3206/index.html","http://localhost:3206/blog.html","http://localhost:3206/services.html","http://localhost:3206/article-final-check-article.html",
              "http://localhost:3207/index.html","http://localhost:3207/blog.html","http://localhost:3207/blogs/water-all-around.html"]:
        reqs.clear(); pg.goto(u); pg.wait_for_timeout(3500)
        api=[r for r in reqs if "/api/" in r]
        check(not api, f"{u}: no content fetched from the CMS ({api[:2]})")
        print(f"{u.split('localhost:')[1]:45} CMS requests: {len(reqs)} {'(only the tiny loader: '+reqs[0].split('/')[-1]+')' if reqs and not api else ''}")
    check("Zion published words" in open("/tmp/zgit/index.html").read(), "the edit is in the file itself")
    pg.goto("http://localhost:3207/index.html"); pg.wait_for_timeout(1500)
    check(pg.locator("text=Zion published words").count()>0, "visitors see the edit (from the file)")
    # editor preview still works, and finds a text whose words were already changed by publishing
    for site,url in [("zion","http://localhost:3207/index.html?cms-edit=1"),("demo","http://localhost:3206/index.html?cms-edit=1")]:
        pg.goto("http://localhost:3208/preview.html#"+url); pg.wait_for_timeout(4000)
        msgs=pg.evaluate("window.msgs")
        check(any(m.get("type")=="ready" for m in msgs), f"{site}: preview script started ({msgs[:1]})")
    pg.goto("http://localhost:3208/preview.html#http://localhost:3207/index.html?cms-edit=1"); pg.wait_for_timeout(4000)
    fr=pg.frame_locator("#f")
    pg.evaluate("""([k,o])=>document.getElementById('f').contentWindow.postMessage({source:'elanster-cms',type:'values',original:{[k]:o},live:{[k]:'Zion published words'},values:{[k]:'Typing in the preview'}},'*')""",[info["key"],info["original"]])
    pg.wait_for_timeout(800)
    check(fr.locator("text=Typing in the preview").count()>0, "preview finds a text by its published words and shows the typing")
    pg.screenshot(path="/home/claude/gt/preview.png")
    b.close()
print(f"git-only: {ok} passed, {bad} failed")
