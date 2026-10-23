#!/usr/bin/env python3
"""Private draft/trash/retry invariants, using only isolated test data."""
import concurrent.futures
import json
import sqlite3
import time
from local_share_security import app, account, create, terminal, approve, link


def main():
    with app() as (req, db, _):
        alice, aid = account(req, 'asset-alice'); bob, bid = account(req, 'asset-bob')
        with sqlite3.connect(db) as conn:
            conn.execute('INSERT INTO uploads VALUES(?,?,?,?)',('private-test-source',aid,'image/png',b'test-only'))
        payload={'title':'Private idea','text':'Full private text '*40,'source_id':'private-test-source'}
        status,d,_=req('/me/drafts',payload,alice);assert status==200,(status,d)
        did=d['id'];path='/drafts/'+did
        assert d['revision']==1 and d['text']==payload['text'] and d['source_url'].endswith('private-test-source')
        assert req('/me/drafts',payload,bob)[0]==404
        for method,body,suffix in [('GET',None,''),('PATCH',{'expected_revision':1,'text':'stolen'},''),('DELETE',None,''),('POST',{},'/restore')]:
            assert req(path+suffix,body,bob,method=method)[0]==404
        assert req('/me/drafts',{'share_token':'not-allowed'},alice)[0]==400
        assert req(path,{'text':'no revision'},alice,method='PATCH')[0]==400
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            replies=list(pool.map(lambda i:req(path,{'expected_revision':1,'title':str(i)},alice,method='PATCH'),range(8)))
        assert [s for s,_,_ in replies].count(200)==1 and [s for s,_,_ in replies].count(409)==7
        assert req(path,None,alice,method='DELETE')[0]==200
        assert req(path,None,alice,method='DELETE')[0]==200
        assert req(path,cookie=alice)[0]==404 and req('/me/drafts',cookie=alice)[1]['items']==[]
        assert req('/me/drafts?state=trash',cookie=alice)[1]['items'][0]['text']==payload['text']
        assert req('/me/drafts?state=trash',cookie=bob)[1]['items']==[]
        status,d,_=req(path+'/restore',{},alice);assert status==200 and d['revision']==4
        assert req(path,{'expected_revision':2,'text':'old tab'},alice,method='PATCH')[0]==409
        # Work deletion keeps descendants and their attribution, but hides direct operations.
        root_job,_=create(req,alice,'asset-root');root=terminal(req,alice,root_job)['version_id']
        child_job,_=create(req,alice,'asset-child',root);child=terminal(req,alice,child_job)['version_id']
        approve(req,alice,root);ln=link(req,alice,root)
        recipient_job,_=create(req,bob,'recipient-child',root,ln['token']);recipient=terminal(req,bob,recipient_job)['version_id']
        pending,_=create(req,alice,'delete-pending',root)
        shared_pending,_=create(req,bob,'shared-delete-pending',root,ln['token'])
        assert req('/versions/'+root,None,bob,method='DELETE')[0]==404
        assert req('/versions/'+root,None,alice,method='DELETE')[0]==200
        assert req('/versions/'+root,None,alice,method='DELETE')[0]==200
        assert terminal(req,alice,pending)['status']=='failed'
        assert terminal(req,bob,shared_pending)['status']=='failed'
        assert req('/generation-jobs/'+shared_pending+'/retry',{},bob,'shared-retry-no-token')[0]==409
        assert req('/generation-jobs/'+shared_pending+'/retry',{'share_token':ln['token']},bob,'shared-retry-revoked')[0]==404
        for suffix,method,body in [('', 'GET',None),('/save','POST',{}),('/favorite','PATCH',{'favorite':True}),('/local-review','POST',{'approved':True}),('/export-permission','GET',None)]:
            assert req('/versions/'+root+suffix,body,alice,method=method)[0]==404,(suffix,method)
        assert req('/share/'+ln['token'])[0]==404
        assert req('/versions/'+child,cookie=alice)[1]['root_version_id']==root
        assert req('/versions/'+recipient,cookie=bob)[1]['root_version_id']==root
        assert req('/versions/'+recipient+'/contributions',cookie=bob)[1]['root_creator_id']==aid
        assert [v['id'] for v in req('/me/works',cookie=alice)[1]['items']]==[child]
        assert [v['id'] for v in req('/me/works?state=trash',cookie=alice)[1]['items']]==[root]
        assert req('/me/works?state=trash',cookie=bob)[1]['items']==[]
        assert req('/me/drafts',{'parent_version_id':root},alice)[0]==404
        assert req('/versions/'+root+'/restore',{},bob)[0]==404
        status,v,_=req('/versions/'+root+'/restore',{},alice)
        assert status==200 and v['local_preview_reviewed'] is False
        assert req('/share/'+ln['token'])[0]==404 and req('/share-links',{'version_id':root},alice)[0]==409
        for cookie,expected in [(alice,200),(bob,404),('',401)]:assert req('/versions/'+root+'/export-permission',cookie=cookie)[0]==expected
        approve(req,alice,root)
        allowed=req('/versions/'+root+'/export-permission',cookie=alice)[1]
        assert allowed=={'allowed':False,'reason':'REVIEW_NOT_CONFIGURED','safety_state':'HOLD','scope':'none'}
        # Retry never substitutes truncated display summary for original text.
        full='Retry full source text '*50
        status,j,_=req('/generation-jobs',{'kind':'first_twist','text':full},alice,'retry-original');assert status==200
        jid=j['id'];retry='/generation-jobs/'+jid+'/retry'
        assert req('/generation-jobs/'+jid+'/cancel',{},alice)[0]==200
        assert req(retry,{},bob,'retry-new')[0]==404
        assert req(retry,{},alice,'retry-original')[0]==409
        status,nextjob,_=req(retry,{},alice,'retry-new');assert status==200
        assert req(retry,{},alice,'retry-new')[1]['id']==nextjob['id']
        with sqlite3.connect(db) as conn:
            raw=conn.execute('SELECT request FROM jobs WHERE id=?',(nextjob['id'],)).fetchone()[0]
        assert json.loads(raw)['text']==full
        assert req('/generation-jobs/'+root_job+'/retry',{},alice,'retry-success')[0]==409
        terminal(req,alice,nextjob['id'])
        # A trashed draft restore must respect the same active count as creation.
        assert req(path,None,alice,method='DELETE')[0]==200
        with sqlite3.connect(db) as conn:
            for i in range(200):
                conn.execute('INSERT INTO drafts VALUES(?,?,?,1,?,?,NULL)',('cap-'+str(i),aid,json.dumps({'title':'','text':'','source_id':None,'parent_version_id':None,'locale':'zh-CN'}),int(time.time()),int(time.time())))
        status,result,_=req(path+'/restore',{},alice)
        assert status==409 and result['error']['code']=='DRAFT_LIMIT',(status,result)
        assert req('/drafts/cap-0/restore',{},alice)[0]==200
        assert len(req('/me/drafts',cookie=alice)[1]['items'])==200
        print('PASS: private drafts/source ownership, optimistic concurrency, recoverable trash, retained descendants/attribution, pending-delete suppression, nonresurrected shares, HOLD export, exact-input retry, restore quota')

if __name__=='__main__':main()
