"""Download the public frontend for compatibility tests; never access an account."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import argparse, hashlib, json, os, re, subprocess, zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('UPSTREAM_DIR', ROOT / 'build/upstream'))
OUT.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--snapshot', type=Path, help='Use a verified public frontend snapshot offline')
args = parser.parse_args()
if args.snapshot:
    metadata = json.loads(args.snapshot.with_suffix('.json').read_text())
    assert hashlib.sha256(args.snapshot.read_bytes()).hexdigest() == metadata['sha256'], 'Snapshot checksum mismatch'
    with zipfile.ZipFile(args.snapshot) as archive:
        assert len(archive.infolist()) == metadata['files']
        for item in archive.infolist():
            assert re.fullmatch(r'[\w.-]+', item.filename), 'Invalid snapshot filename'
            (OUT / item.filename).write_bytes(archive.read(item))
    print(f'Loaded {metadata["files"]} verified public frontend files from {args.snapshot}')
    raise SystemExit(0)

def download(name, url):
    target = OUT / name
    subprocess.run(['curl', '-fsSL', '--retry', '2', '--max-time', '40',
                    '-A', 'Mozilla/5.0', '-o', str(target), url], check=True)
    return target

html = download('index.html', 'https://erp.sex/discover').read_text()
assets = set(re.findall(r'/assets/([\w-]+\.(?:js|css))', html))
seen = set()
with ThreadPoolExecutor(max_workers=8) as pool:
    while assets - seen:
        batch = sorted(assets - seen)
        seen.update(batch)
        for path in pool.map(lambda name: download(name, 'https://erp.sex/assets/' + name), batch):
            if path.suffix == '.js':
                assets.update(re.findall(r'[\"\'](?:/assets/|assets/|\./)([\w-]+\.(?:js|css))[\"\']', path.read_text()))
download('config.json', 'https://erp.sex/api/v1/config')
manifest = {'origin': 'https://erp.sex', 'assets': sorted(seen),
            'css': re.findall(r'/assets/([\w-]+\.css)', html)[0]}
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2))
print(f'Downloaded {len(seen)} public frontend assets into {OUT}')
