#!/usr/bin/env python3
"""Local-only sharing security regression; temporary databases, no live services."""
import concurrent.futures
import contextlib
import http.client
import json
import os
from pathlib import Path
import socket
import sqlite3
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BIN = ROOT/'backend/target/debug/eupra-api'

def port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0)); return s.getsockname()[1]

@contextlib.contextmanager
def app(review=True):
    with tempfile.TemporaryDirectory() as d:
        d = Path(d); web = d/'public';web.mkdir();(web/'index.html').write_text('LOCAL_INDEX');(d/'secret.txt').write_text('OUTSIDE_SECRET')
        p = port(); db = d/'test.sqlite3'
        env = {**os.environ, 'EUPRA_DATABASE':str(db),'EUPRA_BIND':f'127.0.0.1:{p}','EUPRA_PROVIDER':'demo','EUPRA_LOCAL_REVIEW':'1' if review else '0','EUPRA_WEB_DIST':str(web)}
        with (d/'log').open('w+') as log:
            proc = subprocess.Popen([str(BIN)], env=env, stdout=log, stderr=log)
            def req(path, body=None, cookie='', key='', method=None):
                headers={'Content-Type':'application/json','Cookie':cookie,'Idempotency-Key':key}
                request=urllib.request.Request(f'http://127.0.0.1:{p}/api/v1'+path,data=None if body is None else json.dumps(body).encode(),headers=headers,method=method)
                try:r=urllib.request.urlopen(request,timeout=10)
                except urllib.error.HTTPError as e:r=e
                with r:return r.status,json.loads(r.read()),r.headers
            try:
                for _ in range(100):
                    try:req('/config');break
                    except urllib.error.URLError:
                        if proc.poll() is not None:log.seek(0);raise AssertionError(log.read())
                        time.sleep(.05)
                else:raise AssertionError('server startup timeout')
                yield req,db,p
            finally:proc.terminate();proc.wait(timeout=10)

def account(req,name):
    status,user,h=req('/auth/register',{'email':name+'@local.test','password':'local-password-long'})
    assert status==200,(status,user)
    return h['Set-Cookie'].split(';')[0],user['user']['id']

def create(req,cookie,key,parent=None,token=None):
    body={'kind':'continuation' if parent else 'first_twist','text':'a local ordinary event'}
    if parent:body['parent_version_id']=parent
    if token:body['share_token']=token
    status,job,_=req('/generation-jobs',body,cookie,key)
    assert status==200,(status,job)
    return job['id'],body

def terminal(req,cookie,jid):
    for _ in range(150):
        status,j,_=req('/generation-jobs/'+jid,cookie=cookie)
        assert status==200
        if j['status'] in ('succeeded','failed','cancelled'):return j
        time.sleep(.02)
    raise AssertionError('job not terminal')

def approve(req,cookie,vid):
    assert req('/versions/'+vid+'/local-review',{'approved':True},cookie)[0]==200

def link(req,cookie,vid):
    status,v,_=req('/share-links',{'version_id':vid},cookie)
    assert status==200,(status,v)
    return v

def update(db,sql,args=()):
    with sqlite3.connect(db) as conn:conn.execute(sql,args)

def main():
    with tempfile.TemporaryDirectory() as d:
        env={**os.environ,'EUPRA_DATABASE':d+'/test.sqlite3','EUPRA_BIND':'0.0.0.0:0','EUPRA_PROVIDER':'demo','EUPRA_LOCAL_REVIEW':'1'}
        proc=subprocess.run([str(BIN)],env=env,capture_output=True,timeout=5)
        assert proc.returncode!=0 and b'loopback' in proc.stderr,proc.stderr
    with app(False) as (req,db,p):
        cookie,_=account(req,'default');jid,_=create(req,cookie,'root');vid=terminal(req,cookie,jid)['version_id']
        assert req('/versions/'+vid+'/local-review',{'approved':True},cookie)[0]==409
        assert req('/share-links',{'version_id':vid},cookie)[0]==409
    with app() as (req,db,p):
        a,aid=account(req,'alice');b,bid=account(req,'bob')
        jid,_=create(req,a,'root');vid=terminal(req,a,jid)['version_id']
        assert req('/versions/'+vid+'/local-review',{'approved':True},b)[0]==404
        assert req('/share-links',{'version_id':vid},a)[0]==409
        update(db,"UPDATE versions SET data=json_set(data,'$.source_id','PRIVATE_SOURCE_ID','$.story_memory.anchor','PRIVATE_HIDDEN_ANCHOR') WHERE id=?",(vid,))
        approve(req,a,vid);ln=link(req,a,vid);token=ln['token']
        status,public,h=req('/share/'+token)
        assert status==200 and h['Cache-Control']=='no-store' and h['Referrer-Policy']=='no-referrer'
        assert not ({'source_id','story_memory','email','engine'} & public['version'].keys())
        assert 'PRIVATE_SOURCE_ID' not in json.dumps(public) and 'PRIVATE_HIDDEN_ANCHOR' not in json.dumps(public)
        assert public['version']['safety_state']=='HOLD' and public['development_preview']
        for bad in ['bad','f'*96,'0'*97]:assert req('/share/'+bad)[0]==404
        assert req('/generation-jobs',{'kind':'continuation','parent_version_id':vid},b,'no-token')[0]==404
        assert req('/generation-jobs',{'kind':'continuation','parent_version_id':vid,'share_token':token},'', 'anon')[0]==401
        jid,body=create(req,b,'relay',vid,token)
        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
            replies=list(pool.map(lambda _:req('/generation-jobs',body,b,'relay'),range(12)))
        assert all(s==200 and j['id']==jid for s,j,h in replies)
        child=terminal(req,b,jid)['version_id'];status,v,_=req('/versions/'+child,cookie=b)
        assert status==200 and v['root_version_id']==vid and v['parent_version_id']==vid and v['source_id'] is None
        assert 'PRIVATE_SOURCE_ID' not in json.dumps(v) and 'PRIVATE_HIDDEN_ANCHOR' not in json.dumps(v)
        assert req('/versions/'+vid,cookie=b)[0]==404 and req('/versions/'+child,cookie=a)[0]==404
        status,contrib,_=req('/versions/'+child+'/contributions',cookie=b)
        assert status==200 and contrib['root_creator_id']==aid and contrib['parent_creator_id']==aid and contrib['current_creator_id']==bid and not contrib['revenue_enabled']
        assert req('/versions/'+child+'/favorite',{'favorite':True},a,method='PATCH')[0]==404
        assert req('/versions/'+child+'/favorite',{'favorite':True},b,method='PATCH')[0]==200
        assert req('/versions/'+child,cookie=b)[1]['favorite'] is True
        with sqlite3.connect(db) as conn:
            stored=conn.execute('SELECT request FROM jobs WHERE id=?',(jid,)).fetchone()[0]
            hashes=conn.execute('SELECT token_hash FROM share_links').fetchall()
        assert token not in stored and all(token!=row[0] for row in hashes)
        assert req('/share-links/'+ln['id']+'/revoke',{},b)[0]==404
        jid,_=create(req,b,'revoke-pending',vid,token)
        assert req('/share-links/'+ln['id']+'/revoke',{},a)[0]==200
        assert terminal(req,b,jid)['status']=='failed'
        assert req('/share/'+token)[0]==404
        assert req('/generation-jobs',body,b,'revoked-new')[0]==404
        ln=link(req,a,vid);jid,_=create(req,b,'expiry-pending',vid,ln['token'])
        update(db,'UPDATE share_links SET expires_at=? WHERE id=?',(int(time.time())-1,ln['id']))
        assert terminal(req,b,jid)['status']=='failed' and req('/share/'+ln['token'])[0]==404
        ln=link(req,a,vid);jid,_=create(req,b,'withdraw-pending',vid,ln['token'])
        assert req('/versions/'+vid+'/local-review',{'approved':False},a)[0]==200
        assert terminal(req,b,jid)['status']=='failed' and req('/share/'+ln['token'])[0]==404
        assert len(req('/me/works',cookie=b)[1]['items'])==1
        # Inject output categories solely into this isolated test DB to exercise approval guards.
        for patch in ["'$.demo',json('false'),'$.engine.provider','http'", "'$.image_url','/api/v1/uploads/private-image'"]:
            update(db,'UPDATE versions SET data=json_set(data,'+patch+') WHERE id=?',(vid,))
            assert req('/versions/'+vid+'/local-review',{'approved':True},a)[0]==403
            assert req('/share-links',{'version_id':vid},a)[0]==409
            update(db,"UPDATE versions SET data=json_set(data,'$.demo',json('true'),'$.engine.provider','demo','$.image_url',json('null')) WHERE id=?",(vid,))
        for path in ['/share/abc','/%2e%2e/secret.txt','/../secret.txt','/%2e%2e%2fsecret.txt','/api/does-not-exist','/api/v1/does-not-exist']:
            c=http.client.HTTPConnection('127.0.0.1',p,timeout=5);c.request('GET',path);r=c.getresponse();data=r.read();c.close()
            assert b'OUTSIDE_SECRET' not in data,(path,data)
            if path.startswith('/api/'):
                assert r.status==404 and b'LOCAL_INDEX' not in data,(path,r.status,data)
            if path=='/share/abc':assert b'LOCAL_INDEX' in data and r.getheader('Referrer-Policy')=='no-referrer'
        print('PASS: default/loopback gates, owner review, scoped private shares, expiry/revocation at read+commit, replay, creator attribution, favorites, real/image rejection, no orphan nodes, token hygiene, static traversal/API fallback')

if __name__=='__main__':main()
