"""The radio, served on this Mac for testing at http://localhost:8770/, with caching off so
every reload gets the latest files.

    python3 tools/serve.py
"""
import functools
import http.server
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    http.server.ThreadingHTTPServer(('127.0.0.1', 8770), functools.partial(NoCache, directory=str(ROOT))).serve_forever()
