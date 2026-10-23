#!/usr/bin/env python3
"""Verify shipped original design assets; never claim rendered visual parity."""
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
assets=ROOT/'frontend/public/assets';manifest=ROOT/'docs/ASSET-MANIFEST.json'
hashfile=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
if '--record' in sys.argv:
 refs={}
 design=ROOT/'design/extracted'
 if not design.exists():raise SystemExit('Original extracted reference required to record provenance')
 for p in design.rglob('*'):
  if p.is_file() and p.suffix.lower() in {'.png','.jpg','.jpeg','.webp','.svg','.mp4'}:
   refs.setdefault(hashfile(p),[]).append(str(p.relative_to(design)))
 rows=[]
 for p in sorted(assets.rglob('*')):
  if not p.is_file():continue
  digest=hashfile(p);matches=refs.get(digest,[])
  row={'file':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':digest,'exact_original_match':bool(matches),'original_reference':min(matches,key=len) if matches else None,'duplicate_reference_count':len(matches)}
  source=p.with_suffix('.mp4')
  if p.suffix=='.webm' and source.is_file() and refs.get(hashfile(source)):
   row['derivative']={'source':str(source.relative_to(ROOT)),'source_sha256':hashfile(source),'purpose':'Browser-compatible VP9/WebM transcode of the supplied five-second design demonstration; not newly generated media.','transform':'ffmpeg -i SOURCE.mp4 -c:v libvpx-vp9 -crf 32 -b:v 0 -pix_fmt yuv420p -an OUTPUT.webm'}
  rows.append(row)
 manifest.write_text(json.dumps({'note':'Byte provenance only; not browser visual acceptance. Original package SHA256: 27fd2c71375fb4409f839cf36934ed95a66a45057bbe2fae481d1316005f63b5','assets':rows},ensure_ascii=False,indent=2)+'\n')
rows=json.loads(manifest.read_text())['assets']
for row in rows:
 p=ROOT/row['file']
 assert p.is_file(),row['file']
 assert hashfile(p)==row['sha256'],row['file']
 assert p.stat().st_size==row['bytes'],row['file']
 if 'derivative' in row:
  source=ROOT/row['derivative']['source']
  assert source.is_file() and hashfile(source)==row['derivative']['source_sha256'],row['file']
 assert row['exact_original_match'] or 'derivative' in row, 'Missing asset provenance: '+row['file']
print(f'PASS: {len(rows)} shipped assets match recorded bytes; {sum(r["exact_original_match"] for r in rows)} exact original-reference matches; {sum('derivative' in r for r in rows)} documented compatibility derivatives')
