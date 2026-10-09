"""The keeper desk's local server. Serves the desk at http://localhost:8772/desk/ and a small
JSON API around radio/keeper.py, so the secret key stays on this Mac.

    python3 desk/server.py

It listens on 127.0.0.1 only.
"""
import datetime as dt
import http.server
import json
import pathlib
import sys
import tempfile
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'radio'))
import keeper  # noqa: E402  (reads ~/drainer/.env)

PORT = 8772


class KeeperError(Exception):
    pass


def api(method, path, body=None, headers=None):
    try:
        return keeper.call(method, path, body, headers)
    except SystemExit as e:  # keeper.call exits on HTTP errors; turn that into an error reply
        raise KeeperError(str(e)) from None


def now_iso():
    return dt.datetime.now(dt.timezone.utc).isoformat()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):  # keep the terminal quiet except for errors
        if args and str(args[1]).startswith(('4', '5')):
            super().log_message(fmt, *args)

    # --- helpers ---

    def reply(self, status, data):
        raw = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(raw)

    def body(self):
        length = int(self.headers.get('Content-Length', 0))
        return self.rfile.read(length) if length else b''

    def route(self):
        parsed = urllib.parse.urlparse(self.path)
        return parsed.path.rstrip('/').split('/')[2:], urllib.parse.parse_qs(parsed.query)

    def handle_api(self, method):
        try:
            parts, query = self.route()
            self.reply(200, self.dispatch(method, parts, query))
        except KeeperError as e:
            self.reply(502, {'error': str(e)})
        except (ValueError, KeyError, SystemExit) as e:  # keeper's checks exit with a message
            self.reply(400, {'error': str(e)})

    # --- the API ---

    def dispatch(self, method, parts, query):
        q = lambda k, d=None: query.get(k, [d])[0]

        if parts == ['requests'] and method == 'GET':
            return api('GET', '/rest/v1/requests?select=id,song,weather,created_at,done_at&order=created_at.desc&limit=300') or []

        if len(parts) == 2 and parts[0] == 'requests' and method == 'PATCH':
            done = json.loads(self.body() or b'{}').get('done', True)
            api('PATCH', f'/rest/v1/requests?id=eq.{parts[1]}', {'done_at': now_iso() if done else None},
                {'Prefer': 'return=minimal'})
            return {'ok': True}

        if parts == ['tracks'] and method == 'GET':
            return api('GET', '/rest/v1/tracks?select=*&order=added_at') or []

        if len(parts) == 2 and parts[0] == 'tracks' and method == 'PATCH':
            change = json.loads(self.body() or b'{}')
            row = {}
            if 'weather' in change:
                if change['weather'] not in (None, *keeper.WEATHERS):
                    raise ValueError('unknown weather')
                row['weather'] = change['weather']
            if change.get('today'):
                row['added_at'] = keeper.just_before_midnight()
            api('PATCH', f'/rest/v1/tracks?id=eq.{parts[1]}', row, {'Prefer': 'return=minimal'})
            keeper.notify_listeners()
            return {'ok': True}

        if len(parts) == 2 and parts[0] == 'tracks' and method == 'DELETE':
            rows = api('GET', f'/rest/v1/tracks?select=id,file&id=eq.{parts[1]}') or []
            if not rows:
                raise ValueError('no such track')
            api('DELETE', f'/rest/v1/tracks?id=eq.{parts[1]}', headers={'Prefer': 'return=minimal'})
            api('DELETE', f'/storage/v1/object/{keeper.BUCKET}', {'prefixes': [rows[0]['file']]})
            keeper.notify_listeners()
            return {'ok': True}

        if parts == ['upload'] and method == 'POST':
            name = q('filename', 'song.mp3')
            suffix = pathlib.Path(name).suffix.lower()
            if suffix not in keeper.TYPES:
                raise ValueError(f'{name}: only {", ".join(keeper.TYPES)} files')
            weather = q('weather') or None
            if weather and weather not in keeper.WEATHERS:
                raise ValueError('unknown weather')
            with tempfile.TemporaryDirectory() as tmp:
                path = pathlib.Path(tmp) / f'upload{suffix}'
                path.write_bytes(self.body())
                keeper.check_audio(path)
                return keeper.upload_track(path, q('artist', ''), q('title', name), int(q('part', '1')),
                                           q('today') == '1', weather)

        if parts == ['notify'] and method == 'POST':
            keeper.notify_listeners()
            return {'ok': True}

        if parts == ['storage'] and method == 'GET':
            objects = api('POST', f'/storage/v1/object/list/{keeper.BUCKET}',
                          {'prefix': '', 'limit': 1000, 'offset': 0}) or []
            used = sum(int((o.get('metadata') or {}).get('size', 0)) for o in objects)
            return {'bytes': used, 'files': len(objects), 'limitBytes': 1024 ** 3, 'egressLimitBytes': 5 * 1024 ** 3}

        raise KeyError(f'no route {method} /api/{"/".join(parts)}')

    # --- HTTP verbs ---

    def do_GET(self):
        if self.path.startswith('/api/'):
            return self.handle_api('GET')
        if self.path in ('/', ''):
            self.send_response(302)
            self.send_header('Location', '/desk/')
            return self.end_headers()
        return super().do_GET()

    def do_POST(self):
        self.handle_api('POST')

    def do_PATCH(self):
        self.handle_api('PATCH')

    def do_DELETE(self):
        self.handle_api('DELETE')


if __name__ == '__main__':
    print(f'keeper desk on http://localhost:{PORT}/desk/')
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
