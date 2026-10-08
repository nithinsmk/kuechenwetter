"""Tiny local receiver: the open radio page POSTs canvas images here, saved to documentation/.

Run with `python3 tools/receive_images.py`, then POST a PNG to http://localhost:8771/save?name=foo
"""
import http.server
import pathlib
import re
import urllib.parse

OUT = pathlib.Path(__file__).resolve().parent.parent / 'documentation'
OUT.mkdir(exist_ok=True)


class Handler(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        name = re.sub(r'[^a-z0-9_-]+', '-', query.get('name', ['image'])[0].lower())
        data = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        (OUT / f'{name}.png').write_bytes(data)
        self.send_response(200)
        self._cors()
        self.end_headers()
        self.wfile.write(f'saved {name}.png ({len(data)} bytes)'.encode())


http.server.HTTPServer(('127.0.0.1', 8771), Handler).serve_forever()
