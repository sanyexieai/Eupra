#!/usr/bin/env python3
"""Exact private source projection with isolated jobs/uploads; no live user data."""
import json
import sqlite3
from local_share_security import app, account, terminal, approve, link


def main():
    with app() as (req, db, port):
        alice, aid = account(req, 'source-alice')
        bob, bid = account(req, 'source-bob')
        with sqlite3.connect(db) as conn:
            conn.execute('INSERT INTO uploads VALUES(?,?,?,?)', ('source-private', aid, 'image/png', b'PRIVATE_FIXTURE'))
        original = 'Full original entered text, not an 80-character excerpt. ' * 20
        status, job, _ = req('/generation-jobs', {'kind': 'first_twist', 'text': original, 'source_id': 'source-private'}, alice, 'original')
        assert status == 200, job
        root = terminal(req, alice, job['id'])['version_id']
        path = f'/versions/{root}/source'
        status, source, headers = req(path, cookie=alice)
        assert status == 200 and source['text'] == original
        assert source['source_url'] == '/api/v1/uploads/source-private'
        assert set(source) == {'version_id', 'kind', 'text', 'source_id', 'source_url', 'parent_version_id', 'scope'}
        assert headers['Cache-Control'] == 'private, no-store'
        assert headers['X-Content-Type-Options'] == 'nosniff'
        assert headers['Referrer-Policy'] == 'no-referrer'
        assert req(path, cookie=bob)[0] == 404
        assert req(path)[0] == 401
        approve(req, alice, root)
        share = link(req, alice, root)
        status, job, _ = req('/generation-jobs', {'kind': 'continuation', 'parent_version_id': root, 'text': 'Only child input', 'share_token': share['token']}, bob, 'shared-child')
        assert status == 200
        child = terminal(req, bob, job['id'])['version_id']
        status, source, _ = req(f'/versions/{child}/source', cookie=bob)
        assert status == 200 and source['text'] == 'Only child input'
        assert source['source_id'] is None and source['source_url'] is None
        assert source['parent_version_id'] == root
        raw = json.dumps(source)
        for secret in [original, 'source-private', share['token'], 'sha256:', 'story_memory', 'engine']:
            assert secret not in raw
        assert req(f'/versions/{child}/source', cookie=alice)[0] == 404
        assert req(f'/versions/{root}', cookie=alice, method='DELETE')[0] == 200
        assert req(path, cookie=alice)[0] == 404
        assert req(f'/versions/{child}/source', cookie=bob)[0] == 200
        assert req(f'/versions/{root}/restore', {}, alice)[0] == 200
        assert req(path, cookie=alice)[1]['text'] == original
        # Missing or foreign explicit upload fails closed, no inherited fallback.
        with sqlite3.connect(db) as conn:
            conn.execute("UPDATE uploads SET user_id=? WHERE id='source-private'", (bid,))
        status, error, _ = req(path, cookie=alice)
        assert status == 404 and error['error']['code'] == 'SOURCE_UNAVAILABLE'
        with sqlite3.connect(db) as conn:
            conn.execute("UPDATE uploads SET user_id=? WHERE id='source-private'", (aid,))
            conn.execute("INSERT INTO jobs SELECT 'ambiguous-job',user_id,'ambiguous-key',request,data FROM jobs WHERE json_extract(data,'$.version_id')=?", (root,))
        assert req(path, cookie=alice)[1]['error']['code'] == 'SOURCE_UNAVAILABLE'
        with sqlite3.connect(db) as conn:
            conn.execute("UPDATE jobs SET data=json_set(data,'$.status','failed') WHERE json_extract(data,'$.version_id')=?", (root,))
        assert req(path, cookie=alice)[1]['error']['code'] == 'SOURCE_UNAVAILABLE'
    print('PASS source privacy, exact input, shared-parent exclusion, recovery and missing/ambiguous provenance')


if __name__ == '__main__':
    main()
