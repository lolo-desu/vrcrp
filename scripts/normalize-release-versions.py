"""Normalize published versions without rewriting source history or binaries."""
from pathlib import Path
import base64, hashlib, json, os, plistlib, subprocess, zipfile

repo = os.environ['GITHUB_REPOSITORY']
backup = Path('build/release-version-backup')
backup.mkdir(parents=True, exist_ok=True)

def api(path, method='GET', payload=None, missing=False):
    args = ['gh', 'api', f'repos/{repo}/{path}', '--method', method]
    if payload is not None:
        args += ['--input', '-']
    result = subprocess.run(args, input=json.dumps(payload) if payload is not None else None,
                            capture_output=True, text=True)
    if result.returncode:
        if missing and 'HTTP 404' in result.stderr:
            return None
        raise RuntimeError(result.stderr)
    return json.loads(result.stdout) if result.stdout.strip() else None

def download(release, name, folder):
    folder.mkdir(parents=True, exist_ok=True)
    subprocess.run(['gh', 'release', 'download', release['tag_name'], '--repo', repo,
                    '--pattern', name, '--dir', str(folder), '--clobber'], check=True)
    return folder / name

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

for entry in json.loads(Path('release-version-map.json').read_text()):
    version, tag = entry['newVersion'], entry['newTag']
    release = api(f"releases/{entry['releaseId']}")
    assert release['tag_name'] in [entry['oldTag'], tag], release['tag_name']
    folder = backup / tag
    folder.mkdir(exist_ok=True)
    (folder / 'release-before.json').write_text(json.dumps(release, indent=2))
    source = api(f"contents/ERPStable/Info.plist?ref={entry['newCommit']}")
    source_info = base64.b64decode(source['content'])
    assert plistlib.loads(source_info)['CFBundleShortVersionString'] == version
    ref = api(f'git/ref/tags/{tag}', missing=True)
    if ref is None:
        ref = api('git/refs', 'POST', {'ref': f'refs/tags/{tag}', 'sha': entry['newCommit']})
    assert ref['object']['sha'] == entry['newCommit']
    name = f'vrcrp-v{version}-unsigned.ipa'
    original = next((a for a in release['assets'] if a['id'] == entry['oldAssetId']), None)
    ipa = folder / name
    if original:
        old_ipa = download(release, entry['oldIpaName'], folder / 'original')
        assert digest(old_ipa) == entry['ipaSha256'], 'Original asset changed'
        download(release, 'SHA256.txt', folder / 'original')
        assert (folder / 'original/SHA256.txt').read_text().split()[0] == entry['ipaSha256']
        with zipfile.ZipFile(old_ipa) as old, zipfile.ZipFile(ipa, 'w') as new:
            assert old.testzip() is None
            assert not any('_CodeSignature' in n or n.endswith('embedded.mobileprovision') for n in old.namelist())
            info_name = 'Payload/ERPStable.app/Info.plist'
            original_info = plistlib.loads(old.read(info_name))
            original_info['CFBundleShortVersionString'] = version
            assert original_info == plistlib.loads(source_info), 'Source metadata differs beyond version'
            for item in old.infolist():
                new.writestr(item, source_info if item.filename == info_name else old.read(item.filename))
        # All executable/resources stay byte-identical; only metadata changes.
        with zipfile.ZipFile(old_ipa) as old, zipfile.ZipFile(ipa) as new:
            assert new.testzip() is None and old.namelist() == new.namelist()
            assert all(old.read(n) == new.read(n) for n in old.namelist() if n != info_name)
        checksum = folder / 'SHA256.txt'
        checksum.write_text(f'{digest(ipa)}  {name}\n')
        api(f"releases/{entry['releaseId']}", 'PATCH', {'draft': True})
        subprocess.run(['gh', 'release', 'upload', release['tag_name'], '--repo', repo,
                        '--clobber', str(ipa), str(checksum)], check=True)
    else:
        ipa = download(release, name, folder)
    release = api(f"releases/{entry['releaseId']}")
    asset = next(a for a in release['assets'] if a['name'] == name)
    assert asset['digest'] == 'sha256:' + digest(ipa)
    with zipfile.ZipFile(ipa) as z:
        assert z.read('Payload/ERPStable.app/Info.plist') == source_info
    expected_notes = Path(f'release-notes/{tag}.md').read_text()
    release = api(f"releases/{entry['releaseId']}", 'PATCH', {
        'tag_name': tag, 'target_commitish': entry['newCommit'], 'name': f'vrcrp {version}',
        'body': expected_notes, 'draft': True, 'make_latest': 'false'})
    # Verify the newly uploaded bytes before removing the superseded asset.
    remote = download(release, name, folder / 'verified')
    assert digest(remote) == digest(ipa)
    remote_sum = download(release, 'SHA256.txt', folder / 'verified')
    assert remote_sum.read_text().split()[0] == digest(ipa)
    if original:
        api(f"releases/assets/{entry['oldAssetId']}", 'DELETE')
    old_ref = api(f"git/ref/tags/{entry['oldTag']}", missing=True)
    if old_ref is not None:
        assert old_ref['object']['sha'] == entry['oldCommit'], 'Original tag changed'
        api(f"git/refs/tags/{entry['oldTag']}", 'DELETE')
    release = api(f"releases/{entry['releaseId']}", 'PATCH', {'draft': False, 'make_latest': 'false'})
    assert release['tag_name'] == tag and release['target_commitish'] == entry['newCommit']
    assert release['body'] == expected_notes and release['name'] == f'vrcrp {version}'
    assert {a['name'] for a in release['assets']} == {name, 'SHA256.txt'}
    (folder / 'verified.json').write_text(json.dumps({**entry, 'newIpaSha256': digest(ipa),
        'sourceInfoMatches': True, 'executableAndResourcesUnchanged': True}, indent=2))
    print(f'PASS: {tag} title, tag, source, unsigned IPA version and checksum agree')
