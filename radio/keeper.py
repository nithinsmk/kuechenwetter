"""The keeper's desk for Küchenwetter.

    python3 radio/keeper.py requests            songs people have asked for (not yet done)
    python3 radio/keeper.py tracks              what the radio plays
    python3 radio/keeper.py add FILE --artist A --title T [--part N] [--today]
                                                upload an audio file and put it in the rotation
    python3 radio/keeper.py add-mix FOLDER --title T [--today]
                                                upload a folder of songs as one mixtape by Nazif Limpio Saaf,
                                                in file-name order; files are named "01 Artist - Song.mp3"
    python3 radio/keeper.py today ID            put an already-added track on air straight away
    python3 radio/keeper.py done ID [ID ...]    tick requests off
    python3 radio/keeper.py remove ID           take a track out of the rotation (and delete its file)

Reads the Supabase project and secret key from ~/drainer/.env. Never prints the key.
New tracks air from the next Berlin midnight; --today backdates one so it airs straight away.
"""
import argparse
import datetime as dt
import json
import pathlib
import re
import secrets
import ssl
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parent.parent
BUCKET = 'radio'
BERLIN = ZoneInfo('Europe/Berlin')
TYPES = {'.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.wav': 'audio/wav'}


def config():
    env = {}
    for line in (ROOT / '.env').read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            env[key.strip()] = value.strip().strip('"\'')
    match = re.search(r'project/([a-z0-9]{20})', env.get('SUPABASE_PROJECT_PAGE', ''))
    if not match or not env.get('SUPABASE_SECRET_KEY'):
        sys.exit('~/drainer/.env needs SUPABASE_PROJECT_PAGE and SUPABASE_SECRET_KEY')
    return f'https://{match.group(1)}.supabase.co', env['SUPABASE_SECRET_KEY']


def ssl_context():
    # python.org builds ship without CA certificates; fall back to the Mac's own roots.
    context = ssl.create_default_context()
    if context.cert_store_stats()['x509_ca']:
        return context
    pem = subprocess.run(['security', 'find-certificate', '-a', '-p',
                          '/System/Library/Keychains/SystemRootCertificates.keychain'],
                         capture_output=True, text=True, check=True).stdout
    return ssl.create_default_context(cadata=pem)


URL, KEY = config()
SSL = ssl_context()


def call(method, path, body=None, headers=None):
    data = body if isinstance(body, (bytes, type(None))) else json.dumps(body).encode()
    h = {'apikey': KEY}
    if KEY.startswith('eyJ'):
        h['Authorization'] = f'Bearer {KEY}'
    if body is not None and not isinstance(body, bytes):
        h['Content-Type'] = 'application/json'
    h.update(headers or {})
    req = urllib.request.Request(URL + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=600, context=SSL) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        sys.exit(f'{method} {path} failed: {e.code} {e.read().decode(errors="replace")[:400]}')


def seconds_of(path):
    out = subprocess.run(['afinfo', str(path)], capture_output=True, text=True).stdout
    match = re.search(r'estimated duration:\s*([\d.]+)', out)
    if not match:
        sys.exit(f"couldn't read the length of {path.name}")
    return round(float(match.group(1)), 3)


def slug(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')[:60]


def berlin_midnight(day_offset=0):
    now = dt.datetime.now(BERLIN)
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0) + dt.timedelta(days=day_offset)
    return midnight.astimezone(dt.timezone.utc)


def just_before_midnight():
    return (berlin_midnight() - dt.timedelta(minutes=1)).isoformat()


def track_by_prefix(prefix):
    rows = call('GET', '/rest/v1/tracks?select=id,file,artist,title')
    match = [r for r in rows or [] if r['id'].startswith(prefix)]
    if len(match) != 1:
        sys.exit('no single track matches that id')
    return match[0]


def notify_listeners():
    """Tell every open radio to reload the song list now, so everyone stays in sync."""
    call('POST', '/realtime/v1/api/broadcast',
         {'messages': [{'topic': 'kuechenwetter', 'event': 'tracks', 'payload': {}}]})


# --- commands ---

def cmd_requests(_):
    rows = call('GET', '/rest/v1/requests?select=id,song,created_at&done_at=is.null&order=created_at')
    if not rows:
        return print('no open requests')
    for row in rows:
        when = dt.datetime.fromisoformat(row['created_at']).astimezone(BERLIN).strftime('%d %b %H:%M')
        print(f"{row['id'][:8]}  {when}  {row['song']}")


def cmd_tracks(_):
    rows = call('GET', '/rest/v1/tracks?select=id,artist,title,part,seconds,added_at,file&order=added_at')
    if not rows:
        return print('no tracks yet')
    for row in rows:
        airs = dt.datetime.fromisoformat(row['added_at']).astimezone(BERLIN)
        part = f" (part {row['part']})" if row['part'] != 1 else ''
        print(f"{row['id'][:8]}  {row['artist']} – {row['title']}{part}  "
              f"{int(row['seconds'] // 60)}:{int(row['seconds'] % 60):02d}  added {airs:%d %b %H:%M}")


def check_audio(path):
    if not path.exists() or path.suffix.lower() not in TYPES:
        sys.exit(f'{path.name}: need an existing {"/".join(TYPES)} file')
    if path.stat().st_size > 50 * 1024 * 1024:
        sys.exit(f'{path.name} is over the 50 MB limit; split or re-encode it first')


def upload_track(path, artist, title, part, today):
    seconds = seconds_of(path)
    name = f'{slug(artist)}-{slug(title)}-{part}-{secrets.token_hex(3)}{path.suffix.lower()}'
    call('POST', f'/storage/v1/object/{BUCKET}/{urllib.parse.quote(name)}', path.read_bytes(),
         {'Content-Type': TYPES[path.suffix.lower()], 'x-upsert': 'false'})
    row = {'artist': artist, 'title': title, 'part': part, 'file': name, 'seconds': seconds}
    if today:
        row['added_at'] = just_before_midnight()
    call('POST', '/rest/v1/tracks', row, {'Prefer': 'return=minimal'})
    print(f"added {artist} – {title} ({seconds:.0f} s)")


def move_to_added(path):
    """Move a file out of the inbox, so the inbox only shows what's still waiting."""
    inbox = (ROOT / 'radio-inbox').resolve()
    if inbox in path.resolve().parents:
        (inbox / 'added').mkdir(exist_ok=True)
        path.rename(inbox / 'added' / path.name)


def cmd_add(args):
    path = pathlib.Path(args.file).expanduser()
    check_audio(path)
    upload_track(path, args.artist, args.title, args.part, args.today)
    if args.today:
        notify_listeners()
    print('on air today' if args.today else 'on air from the next midnight')
    move_to_added(path)


def cmd_add_mix(args):
    """A folder of songs, in file-name order, as one mixtape show by Nazif Limpio Saaf."""
    folder = pathlib.Path(args.folder).expanduser()
    files = sorted(p for p in folder.iterdir() if p.suffix.lower() in TYPES)
    if not files:
        sys.exit(f'no audio files in {folder}')
    songs = []
    for path in files:
        check_audio(path)
        stem = re.sub(r'^\s*\d+[\s._-]*', '', path.stem)  # drop a leading "01 " / "01_" / "01 - "
        artist, _, song = stem.partition(' - ')
        songs.append((path, f'{artist.strip()} – {song.strip()}' if song else stem.strip()))
    for part, (path, credit) in enumerate(songs, start=1):
        upload_track(path, 'Nazif Limpio Saaf', f'{args.title} · {credit}', part, args.today)
    if args.today:
        notify_listeners()
    print(f"mixtape '{args.title}': {len(songs)} songs, "
          f"{'on air today' if args.today else 'on air from the next midnight'}")
    for path, _ in songs:
        move_to_added(path)


def cmd_done(args):
    open_ids = [row['id'] for row in call('GET', '/rest/v1/requests?select=id&done_at=is.null') or []]
    for short in args.ids:
        matches = [i for i in open_ids if i.startswith(short)]
        if len(matches) != 1:
            print(f'{short}: no single open request matches')
            continue
        call('PATCH', f'/rest/v1/requests?id=eq.{matches[0]}',
             {'done_at': dt.datetime.now(dt.timezone.utc).isoformat()}, {'Prefer': 'return=minimal'})
        print('done', short)


def cmd_today(args):
    track = track_by_prefix(args.id)
    call('PATCH', f"/rest/v1/tracks?id=eq.{track['id']}", {'added_at': just_before_midnight()},
         {'Prefer': 'return=minimal'})
    notify_listeners()
    print(f"{track['artist']} – {track['title']} is on air today")


def cmd_remove(args):
    track = track_by_prefix(args.id)
    call('DELETE', f"/rest/v1/tracks?id=eq.{track['id']}", headers={'Prefer': 'return=minimal'})
    call('DELETE', f'/storage/v1/object/{BUCKET}', {'prefixes': [track['file']]})
    notify_listeners()
    print(f"removed {track['artist']} – {track['title']}")


def main():
    parser = argparse.ArgumentParser(description='Küchenwetter keeper')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('requests').set_defaults(run=cmd_requests)
    sub.add_parser('tracks').set_defaults(run=cmd_tracks)
    add = sub.add_parser('add')
    add.add_argument('file')
    add.add_argument('--artist', required=True)
    add.add_argument('--title', required=True)
    add.add_argument('--part', type=int, default=1)
    add.add_argument('--today', action='store_true', help='air straight away instead of from the next midnight')
    add.set_defaults(run=cmd_add)
    mix = sub.add_parser('add-mix')
    mix.add_argument('folder')
    mix.add_argument('--title', required=True)
    mix.add_argument('--today', action='store_true')
    mix.set_defaults(run=cmd_add_mix)
    today = sub.add_parser('today')
    today.add_argument('id')
    today.set_defaults(run=cmd_today)
    done = sub.add_parser('done')
    done.add_argument('ids', nargs='+')
    done.set_defaults(run=cmd_done)
    remove = sub.add_parser('remove')
    remove.add_argument('id')
    remove.set_defaults(run=cmd_remove)
    args = parser.parse_args()
    args.run(args)


if __name__ == '__main__':
    main()
