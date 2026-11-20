from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_page(viewport={"width":390,"height":844})
    pg.goto("http://localhost:3100/login"); pg.fill("input[type=email]","zadmin@test.com"); pg.fill("input[type=password]","TestPass-123!"); pg.keyboard.press("Enter"); pg.wait_for_timeout(3500)
    for w in (320,375,390,430,560,768,1024,1280,1440,1920):
        pg.set_viewport_size({"width":w,"height":900})
        for route in ("/","/content","/media","/websites","/account"):
            pg.goto("http://localhost:3100"+route); pg.wait_for_timeout(1300)
            r=pg.evaluate("()=>{const m=document.querySelector('main').getBoundingClientRect();const d=document.documentElement;const rail=document.querySelector('.rail');return [Math.round(m.left),Math.round(m.width),d.scrollWidth-d.clientWidth, rail?getComputedStyle(rail).display:'-']}")
            bad = r[2]>2 or (w<=560 and r[0]>20) or r[1] < min(w-40, 600)*0.6
            print(f"{w:5} {route:10} main left {r[0]:4} width {r[1]:5} sideways {r[2]:3} menu {r[3]:5} {'PROBLEM' if bad else 'ok'}")
        if w==390: pg.goto("http://localhost:3100/"); pg.wait_for_timeout(1300); pg.screenshot(path="/home/claude/gt/dash390b.png")
    b.close()
