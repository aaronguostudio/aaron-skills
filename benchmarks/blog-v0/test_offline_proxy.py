import http.client
from http.server import ThreadingHTTPServer
import importlib.util
from pathlib import Path
import tempfile
import threading
import unittest

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('offline_proxy', HERE / 'offline_proxy.py')
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class QuietHandler(MODULE.Handler):
    def log_message(self, *args):
        pass


class ArtifactBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        artifact = self.root / 'offline-trial-1/artifacts/handoff/message.html'
        artifact.parent.mkdir(parents=True)
        artifact.write_text('<p>Generated test result</p>')
        (self.root / 'offline-trial-1/events.jsonl').write_text('not served')
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
        self.server.workspace = self.root
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self, method, path):
        connection = http.client.HTTPConnection(*self.server.server_address)
        connection.request(method, path)
        response = connection.getresponse()
        result = response.status, response.read()
        connection.close()
        return result

    def test_serves_only_declared_offline_artifacts(self):
        status, body = self.request('GET', '/__benchmark_results__/offline-trial-1/artifacts/handoff/message.html')
        self.assertEqual(status, 200)
        self.assertIn(b'Generated test result', body)

    def test_logs_and_traversal_are_not_served(self):
        for path in ['/__benchmark_results__/offline-trial-1/events.jsonl',
                     '/__benchmark_results__/offline-trial-1/artifacts/../events.jsonl',
                     '/__benchmark_results__/offline-trial-1/artifacts/%2e%2e/events.jsonl',
                     '/__benchmark_results__/trial-1/artifacts/handoff/message.html']:
            self.assertEqual(self.request('GET', path)[0], 404)

    def test_writes_are_refused(self):
        self.assertEqual(self.request('POST', '/__benchmark_results__/offline-trial-1/artifacts/handoff/message.html')[0], 405)


if __name__ == '__main__':
    unittest.main()
