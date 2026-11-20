from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch()
    for w,h,name in ((768,800,"w768"),):
        pg=b.new_page(viewport={"width":w,"height":h})
        pg.goto("http://localhost:3100/login"); pg.fill("input[type=email]","admin@elanster.com"); pg.fill("input[type=password]","TestPass-123!"); pg.keyboard.press("Enter"); pg.wait_for_timeout(3500)
        bell=pg.locator("button.bell"); print(name, "bell label:", bell.get_attribute("aria-label")); bell.click(); pg.wait_for_timeout(900)
        box=pg.locator(".note-pop").bounding_box(); print(name, "popup inside screen:", box and box["x"]>=0 and box["x"]+box["width"]<=w+1, box and round(box["width"]))
        pg.screenshot(path=f"/home/claude/gt/bell-{name}.png")
        pg.keyboard.press("Escape"); pg.mouse.click(5, h-5); pg.wait_for_timeout(1200)
        pg.reload(); pg.wait_for_timeout(2500); print(name, "after closing, bell label:", pg.locator("button.bell").get_attribute("aria-label"))
        pg.close()
    b.close()
