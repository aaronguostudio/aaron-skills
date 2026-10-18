#!/usr/bin/env python3
"""Local fixture header proxy: prohibit non-core external connections/frames, never writes."""
import http.client
import argparse
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

CSP = "connect-src 'self'; frame-src 'none'"
HOP = {'connection', 'transfer-encoding', 'keep-alive', 'content-length'}


class Handler(BaseHTTPRequestHandler):
    def forward(self, head=False):
        route = unquote(urlsplit(self.path).path)
        if route.startswith('/__benchmark_results__/'):
            parts = route.removeprefix('/__benchmark_results__/').split('/')
            if len(parts) < 3 or parts[0] not in {'offline-trial-1', 'offline-trial-2', 'offline-trial-3'} or parts[1] != 'artifacts':
                self.send_error(404)
                return
            base = self.server.workspace / parts[0] / 'artifacts'
            path = (self.server.workspace / '/'.join(parts)).resolve()
            if not path.is_relative_to(base.resolve()) or not path.is_file() or path.suffix.lower() not in {'.html', '.mp4', '.png', '.jpg', '.webp', '.txt'}:
                self.send_error(404)
                return
            body = path.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', mimetypes.guess_type(path.name)[0] or 'application/octet-stream')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            if not head:
                self.wfile.write(body)
            return
        upstream = http.client.HTTPConnection('127.0.0.1', 4192, timeout=120)
        headers = {'Host': '127.0.0.1:4190', 'Accept-Encoding': 'identity'}
        for name in ['Accept', 'Accept-Language', 'Cookie', 'Range']:
            if self.headers.get(name):
                headers[name] = self.headers[name]
        upstream.request('HEAD' if head else 'GET', self.path, headers=headers)
        response = upstream.getresponse()
        body = b'' if head else response.read()
        self.send_response(response.status)
        for name, value in response.getheaders():
            if name.lower() not in HOP and name.lower() != 'content-security-policy':
                self.send_header(name, value)
        self.send_header('Content-Security-Policy', CSP)
        self.send_header('Content-Length', response.getheader('Content-Length', '0') if head else str(len(body)))
        self.end_headers()
        if not head:
            self.wfile.write(body)
        upstream.close()

    def do_GET(self):
        self.forward()

    def do_HEAD(self):
        self.forward(head=True)

    def do_POST(self):
        self.send_error(405, 'Read-only benchmark fixture')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace', type=Path, required=True)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', 4190), Handler)
    server.workspace = args.workspace.resolve()
    server.serve_forever()
