import json, re, sys
SUF=sys.argv[1] if len(sys.argv)>1 else ""
from collections import defaultdict
for role in ("super","site-admin","editor"):
    try: d=json.load(open(f"/home/claude/gt/click/{role}{SUF}.json"))
    except Exception as e: print(role, "no data"); continue
    tested=[e for e in d if e["result"] in ("ok","NOTHING HAPPENED") or e["result"].startswith("could not")]
    api=defaultdict(set); perr=defaultdict(set); dead=defaultdict(set); noconf=defaultdict(set); unclick=defaultdict(set)
    for e in d:
        for b in e["bad"]:
            if "917c" in b or "clipboard" in b: continue
            api[re.sub(r"[0-9a-f]{24}","ID",b)].add(e["route"][:28]+" › "+e["label"][:30])
        for x in e["errors"]:
            if "PAGEERROR" in x and "clipboard" not in x.lower(): perr[x[:120]].add(e["route"][:28]+" › "+e["label"][:30])
        if e["result"]=="NOTHING HAPPENED": dead[e["label"][:40]].add(e["route"][:28])
        if e["result"].startswith("could not"): unclick[e["label"][:40]].add(e["route"][:28])
        if e["danger"] and e["blocked"] and not e["dialog"]: noconf[e["label"][:40]+" → "+", ".join(sorted(set(re.sub(r"[0-9a-f]{24}","ID",x) for x in e["blocked"])))].add(e["route"][:28])
    print(f"\n===== {role}: {len(d)} controls found, {len(tested)} clicked")
    print("-- failing server answers:"); [print("  ",k,"←",sorted(v)[:3]) for k,v in api.items()]
    print("-- script errors:"); [print("  ",k,"←",sorted(v)[:2]) for k,v in perr.items()]
    print("-- dangerous action WITHOUT a confirm question:"); [print("  ",k,"on",sorted(v)[:3]) for k,v in noconf.items()]
    print("-- nothing happened:"); [print("  ",k,"on",sorted(v)[:4]) for k,v in dead.items()]
