from playwright.sync_api import sync_playwright
ok=0; bad=0
def check(c,m):
    global ok,bad
    if c: ok+=1
    else: bad+=1; print("FAIL",m)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":900})
    missing=[]; pg.on("response", lambda r: missing.append(r.url) if r.status>=400 and "localhost:320" in r.url else None)
    pg.goto("http://localhost:3206/blog.html"); pg.wait_for_timeout(2500)
    first=pg.locator("#blogList a.post").first; href=first.get_attribute("href"); check(href.startswith("blog/"), "card links to blog/: "+href)
    first.click(); pg.wait_for_timeout(3000)
    check("/blog/" in pg.url, "opened "+pg.url)
    css=pg.evaluate("getComputedStyle(document.querySelector('.nav__links')||document.body).display")
    check(css!="inline" , "styles loaded inside blog/ (nav display: %s)"%css)
    pg.screenshot(path="/home/claude/gt/blogdir-article.png")
    back=pg.locator("a.art__back"); check(back.get_attribute("href")=="../blog.html", "back link: "+str(back.get_attribute("href")))
    more=pg.locator(".art__more a.post").first
    if more.count(): mh=more.get_attribute("href"); check(mh.startswith("../blog/"), "keep reading link: "+mh); more.click(); pg.wait_for_timeout(2000); check("/blog/" in pg.url, "keep reading opens "+pg.url)
    nav=pg.locator('.nav__links a[href="../services.html"]'); check(nav.count()>0, "menu links fixed for the folder")
    # home page card to a live article
    pg.goto("http://localhost:3206/index.html"); pg.wait_for_timeout(2000)
    hl=pg.locator('a[href^="blog/"]').count(); check(hl>0, "home page links to blog/ files: %d"%hl)
    check(not [m for m in missing if not m.endswith("favicon.ico")], "no missing files: "+", ".join(missing[:5]))
    b.close()
print(f"blog-folder: {ok} passed, {bad} failed")
