#!/usr/bin/env python3
"""Create a local, self-contained original-vs-runtime visual review bundle.

Copies exact images; no screenshot is retouched or treated as a generated result.
The original private design archive is deliberately not a repository dependency.
"""
from pathlib import Path
import argparse, html, json, shutil
p=argparse.ArgumentParser()
p.add_argument('--design',type=Path,required=True)
p.add_argument('--runtime',type=Path,required=True)
p.add_argument('--output',type=Path,required=True)
p.add_argument('--commit',required=True)
a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
assets=a.output/'images';assets.mkdir(exist_ok=True)
records=[];sections=[]
for number in range(0,14):
 code="WEB-01" if number==0 else f"CN-{number:02}"
 originals=list(a.design.glob(f'**/preview/{code}_mobile_zh-CN.png'))
 if not originals:originals=list(a.design.glob(f'**/preview/{code}_world_zh-CN.png'))
 if not originals:raise SystemExit(f'Missing original mobile reference {code}')
 original=originals[0];original_name=f'{code}-original-mobile.png';shutil.copyfile(original,assets/original_name)
 desktop=list(a.design.glob(f'**/preview/{code}_desktop_showcase.png')) or list(a.design.glob(f'**/preview/{code}_desktop_zh-CN.png'))
 desktop_name=None
 if desktop:desktop_name=f'{code}-original-desktop.png';shutil.copyfile(desktop[0],assets/desktop_name)
 runtime_code='CN-03-cancelled' if number==3 else code
 runtimes={}
 for size in ('mobile','desktop'):
  source=a.runtime/f'{runtime_code}-{size}-zh-CN-demo.png'
  if source.exists():
   name=f'{code}-runtime-{size}.png';shutil.copyfile(source,assets/name);runtimes[size]=name
 note='Original shows a running job; runtime shows a real cancelled job. State difference is intentional, not a fidelity pass.' if number==3 else 'Runtime private works are honest text-only demo outputs. Original sample imagery is not substituted into user works.'
 row={'page':code,'commit':a.commit,'original_mobile':str(original),'original_desktop':str(desktop[0]) if desktop else None,'runtime':runtimes,'note':note};records.append(row)
 def figure(label,name):return f'<figure><figcaption>{html.escape(label)}</figcaption><img loading="lazy" src="images/{name}" alt="{html.escape(label)}"></figure>'
 sections.append(f'<section id="{code}"><h2>{code}</h2><p>{html.escape(note)}</p><div class="pair">'+figure('Original Chinese mobile reference',original_name)+figure('Actual Chinese mobile runtime',runtimes['mobile'])+'</div><details><summary>Desktop comparison</summary><p>'+('Original desktop showcase is supplied below.' if desktop else 'No matching desktop reference was supplied for this page. Compare responsive structure to the mobile original; do not claim desktop pixel parity.')+'</p><div class="desktop">'+(figure('Original desktop showcase',desktop_name) if desktop_name else '')+figure('Actual desktop runtime',runtimes['desktop'])+'</div></details></section>')
nav=' '.join(f'<a href="#{r["page"]}">{r["page"]}</a>' for r in records)
body='''<!doctype html><html lang="en"><meta charset="utf-8"><title>Eupra original / runtime visual comparison</title><style>body{font:16px system-ui;background:#ececf4;color:#202037;margin:24px}h1{font-size:28px}nav{position:sticky;top:0;background:white;padding:12px;z-index:1;display:flex;gap:12px;flex-wrap:wrap}section{background:white;padding:20px;margin:24px 0;border-radius:16px}figure{margin:0;min-width:0}figcaption{font-weight:700;margin-bottom:12px}.pair{display:grid;grid-template-columns:390px 390px;gap:24px;overflow:auto;align-items:start}.pair img{width:390px;height:auto}.desktop{display:grid;gap:24px}.desktop img{max-width:100%;height:auto}summary{cursor:pointer;font-weight:700;margin:18px 0}p{max-width:100ch;line-height:1.5}</style><h1>Original design / actual runtime</h1>'''
body+=f'<p>Runtime commit: <code>{html.escape(a.commit)}</code>. Exact source images are displayed at a common 390 CSS-pixel width, without retouching. Original device status bars are reference art, not application UI. Differences in content, review state and page length must be reviewed explicitly. This is evidence for comparison, not a claim of parity.</p><nav>{nav}</nav>'+''.join(sections)+'</html>'
(a.output/'index.html').write_text(body)
(a.output/'manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
print(f'Created {len(records)} page comparisons in {a.output}')
