#!/usr/bin/env python3
"""Build a deterministic source checkpoint, never credentials/runtime state."""
from pathlib import Path
import zipfile, hashlib, sys
root=Path(__file__).resolve().parents[1]
out=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root.parent/'Eupra-source.zip'
blocked={'.tooling','.library-helpers','node_modules','target','dist','.git','data','__pycache__','artifacts'}
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(root.rglob('*')):
  rel=p.relative_to(root)
  if not p.is_file() or any(x in blocked for x in rel.parts) or rel.parts[0]=='design': continue
  if p.name.startswith('.env') and p.name!='.env.example': continue
  if p.suffix in {'.db','.sqlite3','.sqlite','.log','.zip'} or p.name.endswith(('.db-wal','.db-shm','.sqlite3-wal','.sqlite3-shm','.sqlite-wal','.sqlite-shm')):continue
  info=zipfile.ZipInfo(str(Path('Eupra')/rel),date_time=(2026,10,23,0,0,0))
  info.compress_type=zipfile.ZIP_DEFLATED
  info.external_attr=(p.stat().st_mode & 0xFFFF)<<16
  z.writestr(info,p.read_bytes())
print(out)
print('SHA256',hashlib.sha256(out.read_bytes()).hexdigest())
print('Bytes',out.stat().st_size)
