# Python 3

import sys
import socketserver
from http.server import SimpleHTTPRequestHandler

class WasmHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Include additional response headers here. CORS for example:
        self.send_header('cross-origin-embedder-policy', 'require-corp')
        self.send_header('cross-origin-opener-policy', 'same-origin')
        SimpleHTTPRequestHandler.end_headers(self)

if __name__ == '__main__':
    PORT = 6502
    with socketserver.TCPServer(("", PORT), WasmHandler) as httpd:
        print("Listening on port {}. Press Ctrl+C to stop.".format(PORT))
        httpd.serve_forever()