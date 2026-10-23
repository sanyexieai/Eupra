#!/usr/bin/env python3
"""Isolated HTTP adapter regressions. Local mock only; never uses live credentials."""
import base64
import struct
import zlib
import http.server
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
seen = []
started = threading.Event()
release = threading.Event()

class Mock(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        seen.append(self.path)
        assert self.headers['Authorization'] == 'Bearer local-test-only'
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        req = body['request']
        text = req.get('text') or ''
        if text == 'redirect':
            self.send_response(302)
            self.send_header('Location', '/must-not-follow')
            self.end_headers()
            return
        if text == 'oversized-response':
            self.send_response(200)
            self.send_header('Content-Length', str(17*1024*1024))
            self.end_headers()
            return
        if text.startswith('delay'):
            started.set()
            assert release.wait(10), 'test did not release delayed response'
        memory = req.get('story_memory') or {'immutable_facts': ['room controls attendance'], 'open_loops': [], 'recent_genes': ['A03'], 'source_anchors': [], 'previous_events': []}
        result = {'request_id': req['request_id'], 'demo': False, 'model': 'local-security-test',
                  'candidates': [{'id': 'best', 'genes': ['A03', 'A04'], 'hook': 'A specific reversal', 'caption': 'The meeting room requires its manager to book leave.', 'payoff': 'The room controls attendance.', 'next_seed': 'Who approves the room?', 'scores': dict.fromkeys(['surprise', 'relevance', 'specificity', 'deadpan', 'identity_fantasy', 'visual_impact', 'remixability', 'shareability'], 4.5), 'penalties': [0]*5, 'safety_passed': True, 'fidelity_passed': True}],
                  'selected_candidate_id': 'best', 'updated_story_memory': memory, 'image_url': '',
                  'review': {'policy_version': '20261020', 'input_passed': True, 'output_passed': True, 'export_passed': False, 'ai_label_applied': False, 'review_id': 'local-test-review'}, 'cost_microunits': 0, 'currency': 'USD'}
        if text == 'wrong-id': result['request_id'] = 'unrelated-job'
        if text == 'unsafe': result['review']['output_passed'] = False
        if text == 'remote-image': result['image_url'] = 'http://127.0.0.1/private?secret=must-not-leak'
        if text == 'bad-image': result['image_base64'] = 'not-valid-base64!'
        if text == 'oversized-image':
            def chunk(t, data): return struct.pack('>I', len(data))+t+data+struct.pack('>I', zlib.crc32(t+data))
            png = b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR', struct.pack('>2I5B', 5000, 5000, 8, 2, 0, 0, 0))+chunk(b'IDAT', zlib.compress(b'\x00\xff\x00\x00'))+chunk(b'IEND', b'')
            result['image_base64'] = base64.b64encode(png).decode()
        if text == 'drift': result['updated_story_memory'] = {**memory, 'immutable_facts': []}
        payload = json.dumps(result).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def main():
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Mock)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]
    base = f'http://127.0.0.1:{port}/api/v1'
    def request(path, body=None, cookie='', key='', method=None):
        headers = {'Content-Type': 'application/json', 'Cookie': cookie, 'Idempotency-Key': key}
        req = urllib.request.Request(base+path, data=None if body is None else json.dumps(body).encode(), headers=headers, method=method)
        try:
            r = urllib.request.urlopen(req, timeout=10)
        except urllib.error.HTTPError as e:
            r = e
        with r:
            raw = r.read()
            assert b'local-test-only' not in raw and b'must-not-leak' not in raw, raw
            return r.status, json.loads(raw), r.headers
    with tempfile.TemporaryDirectory() as d:
        env = {**os.environ, 'EUPRA_DATABASE': d+'/test.sqlite3', 'EUPRA_BIND': f'127.0.0.1:{port}', 'EUPRA_PROVIDER': 'http', 'EUPRA_ENGINE_URL': f'http://127.0.0.1:{server.server_port}/engine', 'EUPRA_ENGINE_KEY': 'local-test-only'}
        with open(d+'/log', 'w+') as log:
            proc = subprocess.Popen([str(ROOT/'backend/target/debug/eupra-api')], env=env, stdout=log, stderr=log)
            try:
                for _ in range(100):
                    try:
                        status, config, _ = request('/config')
                        assert config['provider'] == 'http', config
                        break
                    except (ConnectionError, urllib.error.URLError): time.sleep(.05)
                else: raise AssertionError('API did not start')
                status, _, h = request('/auth/register', {'email': 'test@example.test', 'password': 'local-test-password'})
                assert status == 200
                cookie = h['Set-Cookie'].split(';')[0]
                def create(text, parent=None):
                    data = {'kind': 'continuation' if parent else 'first_twist', 'text': text}
                    if parent: data['parent_version_id'] = parent
                    status, job, _ = request('/generation-jobs', data, cookie, text)
                    assert status == 200, (status, job)
                    return job['id']
                def terminal(jid):
                    for _ in range(200):
                        status, job, _ = request('/generation-jobs/'+jid, cookie=cookie)
                        assert status == 200
                        if job['status'] in ('succeeded', 'failed', 'cancelled'): return job
                        time.sleep(.02)
                    raise AssertionError('job did not reach terminal state')
                root = terminal(create('good'))
                assert root['status'] == 'succeeded'
                vid = root['version_id']
                for case, code in [('wrong-id','SAFETY_OUTPUT_HOLD'),('unsafe','SAFETY_OUTPUT_HOLD'),('remote-image','REMOTE_IMAGE_URL_UNSUPPORTED'),('bad-image','INVALID_PROVIDER_IMAGE'),('redirect','PROVIDER_REJECTED'),('oversized-response','PROVIDER_RESPONSE_TOO_LARGE'),('oversized-image','INVALID_PROVIDER_IMAGE')]:
                    job = terminal(create(case))
                    assert job['status'] == 'failed' and job['error']['code'] == code, job
                job = terminal(create('drift', vid))
                assert job['status'] == 'failed' and job['error']['code'] == 'STORY_MEMORY_DRIFT', job
                jid = create('delay-cancel')
                assert started.wait(5)
                status, job, _ = request('/generation-jobs/'+jid+'/cancel', {}, cookie)
                assert status == 200 and job['status'] == 'cancelled'
                release.set();time.sleep(.2)
                assert terminal(jid)['status'] == 'cancelled'
                started.clear();release.clear()
                jid = create('delay-revoke', vid)
                assert started.wait(5)
                status, _, _ = request('/versions/'+vid+'/remix-permission', {'remix_allowed':False}, cookie, method='PATCH')
                assert status == 200
                release.set()
                job = terminal(jid)
                assert job['status'] == 'failed' and job['error']['code'] == 'REMIX_DISABLED', job
                status, works, _ = request('/me/works', cookie=cookie)
                assert status == 200 and len(works['items']) == 1, works
                assert '/must-not-follow' not in seen, seen
                assert works['items'][0]['safety_state'] == 'HOLD'
                # A provider response arriving after parent trash must never commit a child.
                status, _, _ = request('/versions/'+vid+'/remix-permission', {'remix_allowed':True}, cookie, method='PATCH')
                assert status == 200
                started.clear();release.clear()
                jid = create('delay-delete', vid)
                assert started.wait(5)
                status, _, _ = request('/versions/'+vid, cookie=cookie, method='DELETE')
                assert status == 200
                release.set()
                job = terminal(jid)
                assert job['status'] == 'failed' and job['error']['code'] == 'PARENT_UNAVAILABLE', job
                assert request('/me/works', cookie=cookie)[1]['items'] == []
                assert len(request('/me/works?state=trash', cookie=cookie)[1]['items']) == 1

                print('PASS: provider wire success, request binding, safety hold, URL/image rejection, redirect rejection, immutable memory, in-flight cancellation/revocation, no orphan versions or secret leakage')
            finally:
                release.set()
                proc.terminate();proc.wait(timeout=10)
                log.seek(0)
                logs = log.read()
                assert 'local-test-only' not in logs and 'must-not-leak' not in logs, logs
                server.shutdown()

if __name__ == '__main__': main()
