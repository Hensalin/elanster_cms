# Clicks every button / link / tab on every CMS screen, per role. Each click starts from a freshly loaded screen.
import json, re, sys, hashlib, time
from playwright.sync_api import sync_playwright
BASE="http://localhost:3100"; PW="TestPass-123!"
ROLES={"super":"admin@elanster.com","site-admin":"zadmin@test.com","editor":"zeditor@test.com"}
DANGER=re.compile(r"delete|remove|revoke|log ?out|sign out|turn off|discard|unpublish|reset|deactivat|reject|throw away|take back|withdraw|request changes|approve|publish|send for review|submit|archive|erase|clear all", re.I)
ROUTES=json.load(open("/home/claude/gt/click/routes.json"))
SEL="main button:visible, main a[href]:visible, main [role=tab]:visible, main [role=button]:visible, main input[type=checkbox]:visible, main select:visible, header button:visible, header a[href]:visible, nav a[href]:visible, aside a[href]:visible, aside button:visible"
role=sys.argv[1]; out=[]; START=int(sys.argv[2]) if len(sys.argv)>2 else 0
import os
if START and os.path.exists(f"/home/claude/gt/click/{role}-2.json"): out=json.load(open(f"/home/claude/gt/click/{role}-2.json"))
def label(el):
    try:
        t=(el.get_attribute("aria-label") or el.inner_text() or el.get_attribute("title") or el.get_attribute("href") or el.evaluate("e=>e.tagName")).strip()
    except Exception: t="?"
    return re.sub(r"\s+"," ",t)[:60]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1366,"height":900}); pg=ctx.new_page()
    pg.goto(BASE+"/login"); pg.fill("input[type=email]",ROLES[role]); pg.fill("input[type=password]",PW); pg.keyboard.press("Enter"); pg.wait_for_timeout(4000)
    for route in ROUTES[role][START:]:
        pg.goto(BASE+route); pg.wait_for_timeout(2500)
        els=pg.query_selector_all(SEL); seen=set(); targets=[]
        for i,e in enumerate(els):
            l=label(e); tag=e.evaluate("e=>e.tagName")
            k=(tag,l)
            if k in seen or not l: continue
            seen.add(k); targets.append((i,l,tag))
        targets=targets[:50]; ev_needs_reload=[True]
        for (i,l,tag) in targets:
            ev={"route":route,"i":i,"label":l,"tag":tag,"errors":[],"bad":[],"dialog":None,"mut":[],"blocked":[]}
            danger=bool(DANGER.search(l)); danger_flag=[False]
            def on_console(m):
                if m.type=="error" and "favicon" not in m.text: ev["errors"].append(m.text[:160])
            def on_perr(e): ev["errors"].append("PAGEERROR "+str(e)[:160])
            def on_resp(r):
                if "/api/" in r.url and r.status>=400: ev["bad"].append(f"{r.request.method} {r.url.split('/api/')[1][:60]} {r.status}")
            def on_dialog(d): ev["dialog"]=d.message[:100]; d.dismiss()
            def on_route(rt):
                req=rt.request
                if req.method in ("POST","PUT","PATCH","DELETE") and "/api/" in req.url and (danger or danger_flag[0]):
                    ev["blocked"].append(f"{req.method} {req.url.split('/api/')[1][:60]}"); rt.abort(); return
                if req.method in ("POST","PUT","PATCH","DELETE") and "/api/" in req.url: ev["mut"].append(f"{req.method} {req.url.split('/api/')[1][:60]}")
                rt.continue_()
            pg.on("console",on_console); pg.on("pageerror",on_perr); pg.on("response",on_resp); pg.on("dialog",on_dialog); pg.route("**/*",on_route)
            try:
                if pg.url.replace(BASE,"") != route or ev_needs_reload[0]:
                    pg.goto(BASE+route, wait_until="domcontentloaded"); pg.wait_for_timeout(1500); ev_needs_reload[0]=False
                else:
                    pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
                els2=pg.query_selector_all(SEL)
                el=None
                for e in els2:
                    if label(e)==l and e.evaluate("e=>e.tagName")==tag: el=e; break
                if not el: ev["result"]="not found after reload"; raise StopIteration
                before_url=pg.url; before=hashlib.md5(pg.content().encode()).hexdigest()
                reqs=[]; hreq=lambda r: reqs.append(r.url); pg.on("request",hreq)
                pops=[]; hpop=lambda p2: pops.append(p2); ctx.on("page",hpop)
                if tag=="SELECT":
                    opts=el.evaluate("e=>[...e.options].map(o=>o.value)")
                    if len(opts)>1: el.select_option(opts[1])
                else:
                    try: el.click(timeout=3000)
                    except Exception as ex: ev["result"]="could not click: "+str(ex).split("\n")[0][:80]; raise StopIteration
                pg.wait_for_timeout(900)
                pg.remove_listener("request",hreq); ctx.remove_listener("page",hpop)
                for p2 in pops:
                    try: p2.close()
                    except Exception: pass
                invalid = pg.evaluate("!!document.querySelector('form :invalid')")
                after=hashlib.md5(pg.content().encode()).hexdigest()
                ev["navigated"]= pg.url!=before_url; ev["changed"]= after!=before; ev["requests"]=len([r for r in reqs if "/api/" in r or "_rsc" in r])
                ev["popup"]=len(pops); ev["asks_to_fill"]=bool(invalid) and not ev["changed"]
                ev["result"]= "ok" if (ev["navigated"] or ev["changed"] or ev["dialog"] or ev["requests"] or ev["blocked"] or pops or ev["asks_to_fill"]) else "NOTHING HAPPENED"
                # a window opened: click the buttons inside it too
                modal = pg.query_selector("[role=dialog]:visible, .modal:visible")
                if modal and ev["changed"]:
                    inner=[]
                    for m in modal.query_selector_all("button:visible, a[href]:visible, input[type=checkbox]:visible"):
                        ml=label(m)
                        if ml and ml not in [x[0] for x in inner]: inner.append((ml, m))
                    ev["inside"]=[]
                    for ml,_ in inner[:12]:
                        sub={"label":ml}; mdanger=bool(DANGER.search(ml)); danger_now=[mdanger]
                        try:
                            mm=None
                            modal=pg.query_selector("[role=dialog]:visible, .modal:visible")
                            if not modal: el.click(timeout=3000); pg.wait_for_timeout(700); modal=pg.query_selector("[role=dialog]:visible, .modal:visible")
                            for m in (modal.query_selector_all("button:visible, a[href]:visible, input[type=checkbox]:visible") if modal else []):
                                if label(m)==ml: mm=m; break
                            if not mm: sub["result"]="not found"; ev["inside"].append(sub); continue
                            h1=hashlib.md5(pg.content().encode()).hexdigest(); n0=len(ev["mut"])+len(ev["blocked"]); d0=ev["dialog"]
                            if mdanger: danger_flag[0]=True
                            mm.click(timeout=2500); pg.wait_for_timeout(700); danger_flag[0]=False
                            inv=pg.evaluate("!!document.querySelector('form :invalid')")
                            sub["result"]="ok" if (hashlib.md5(pg.content().encode()).hexdigest()!=h1 or len(ev["mut"])+len(ev["blocked"])>n0 or ev["dialog"]!=d0 or inv) else "NOTHING HAPPENED"
                        except Exception as ex: sub["result"]="error "+str(ex).split("\n")[0][:60]
                        ev["inside"].append(sub)
                if pg.url!=before_url: ev["to"]=pg.url.replace(BASE,"")
                if ev["changed"] or ev["mut"] or ev["blocked"]: ev_needs_reload[0]=True
            except StopIteration: pass
            except Exception as ex: ev["result"]="error: "+str(ex)[:100]
            finally:
                try:
                    pg.remove_listener("console",on_console); pg.remove_listener("pageerror",on_perr); pg.remove_listener("response",on_resp); pg.remove_listener("dialog",on_dialog); pg.unroute("**/*")
                except Exception:
                    pg=ctx.new_page(); ev_needs_reload[0]=True   # the tab crashed: carry on in a new one
            ev["danger"]=danger; out.append(ev)
        print(route, len(targets), "tested", flush=True); json.dump(out,open(f"/home/claude/gt/click/{role}-2.json","w"),indent=1)
    b.close()
json.dump(out,open(f"/home/claude/gt/click/{role}-2.json","w"),indent=1)
print("done", len(out))
