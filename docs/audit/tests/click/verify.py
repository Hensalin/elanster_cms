from playwright.sync_api import sync_playwright
res=[]
def ok(c,m): res.append(("PASS" if c else "FAIL")+"  "+m)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1366,"height":900})
    muts=[]; pg.on("request", lambda r: muts.append(r.method+" "+r.url.split("/api/")[-1][:50]) if r.method in ("POST","PUT","DELETE","PATCH") and "/api/" in r.url and "notifications" not in r.url and "sync-pages" not in r.url else None)
    dialogs=[]
    def on_d(d): dialogs.append(d.message); d.dismiss()
    pg.on("dialog", on_d)
    pg.goto("http://localhost:3100/login"); pg.fill("input[type=email]","admin@elanster.com"); pg.fill("input[type=password]","TestPass-123!"); pg.keyboard.press("Enter"); pg.wait_for_timeout(3500)
    muts.clear()
    # dashboard Unpublish
    pg.goto("http://localhost:3100/"); pg.wait_for_timeout(2500); n=len(dialogs)
    u=pg.get_by_role("button", name="Unpublish").first
    if u.count(): u.click(); pg.wait_for_timeout(800); ok(len(dialogs)>n and not muts, f"Dashboard Unpublish asks first ({dialogs[-1] if len(dialogs)>n else 'no question'}); cancelling changes nothing")
    # content list Unpublish
    muts.clear(); pg.goto("http://localhost:3100/content"); pg.wait_for_timeout(3000); n=len(dialogs)
    u=pg.locator("td.row-act").get_by_role("button", name="Unpublish").first
    if u.count(): u.click(); pg.wait_for_timeout(800); ok(len(dialogs)>n and not [m for m in muts if "publish" in m], "Content list Unpublish asks first")
    # website turn off
    muts.clear(); pg.goto("http://localhost:3100/websites"); pg.wait_for_timeout(2500); n=len(dialogs)
    t=pg.locator("button[aria-label^='Turn off']").first
    if t.count(): t.click(); pg.wait_for_timeout(800); ok(len(dialogs)>n and not [m for m in muts if "websites" in m], f"Turning a website off asks first ({dialogs[-1][:60] if len(dialogs)>n else 'no question'})")
    # empty category
    pg.goto("http://localhost:3100/categories"); pg.wait_for_timeout(2500)
    pg.locator("form.row-form button").click(); pg.wait_for_timeout(600)
    ok(any("name" in x.inner_text() for x in pg.query_selector_all(".toast")), "Empty category name shows a message")
    # editor: no automatic sync, no Sync button
    pg2=b.new_page(); errs=[]; pg2.on("response", lambda r: errs.append(r.url) if r.status==403 and "sync-pages" in r.url else None)
    pg2.goto("http://localhost:3100/login"); pg2.fill("input[type=email]","zeditor@test.com"); pg2.fill("input[type=password]","TestPass-123!"); pg2.keyboard.press("Enter"); pg2.wait_for_timeout(3500)
    pg2.goto("http://localhost:3100/content"); pg2.wait_for_timeout(3500)
    ok(not errs, "Editor: opening Content gives no sync error")
    ok(pg2.get_by_role("button", name="Sync from website").count()==0, "Editor: no Sync button")
    pg2.goto("http://localhost:3100/pages"); pg2.wait_for_timeout(2500)
    ok(pg2.get_by_role("button", name="Connect website").count()==0 and pg2.get_by_role("button", name="Import from file").count()==0, "Editor: old Pages screen has no admin-only buttons")
    # website admin still sees Sync
    pg3=b.new_page(); pg3.goto("http://localhost:3100/login"); pg3.fill("input[type=email]","zadmin@test.com"); pg3.fill("input[type=password]","TestPass-123!"); pg3.keyboard.press("Enter"); pg3.wait_for_timeout(3500)
    pg3.goto("http://localhost:3100/content"); pg3.wait_for_timeout(3000)
    ok(pg3.get_by_role("button", name="Sync from website").count()>0, "Website Admin: Sync button still there")
    b.close()
print("\n".join(res)); print(f"verify: {sum(r.startswith('PASS') for r in res)} passed, {sum(r.startswith('FAIL') for r in res)} failed")
