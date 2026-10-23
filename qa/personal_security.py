#!/usr/bin/env python3
"""Personal CN controls: isolated SQLite fixtures, no provider or live user data."""
import json
import sqlite3
import time
import urllib.error
import urllib.request
from local_share_security import app, account, create, terminal


def main():
    with app() as (req,db,port):
        alice,aid=account(req,'personal-alice');bob,bid=account(req,'personal-bob')
        for path in ['/me/profile','/me/creator-summary','/me/appeals','/me/video-credits']:
            assert req(path)[0]==401,path
        status,profile,_=req('/me/profile',cookie=alice)
        assert status==200 and profile['user_id']==aid and profile['avatar_url'] is None
        with sqlite3.connect(db) as conn:
            conn.execute('INSERT INTO uploads VALUES(?,?,?,?)',('private-avatar',aid,'image/png',b'PRIVATE_AVATAR_FIXTURE'))
        status,profile,_=req('/me/profile',{'nickname':'  测试昵称  ','bio':'Private fixture bio','avatar_asset_id':'private-avatar'},alice,method='PATCH')
        assert status==200 and profile['nickname']=='测试昵称' and profile['avatar_url']=='/api/v1/uploads/private-avatar'
        assert req('/me/profile',{'avatar_asset_id':'private-avatar'},bob,method='PATCH')[0]==404
        assert req('/me/profile',cookie=bob)[1]['nickname']==''
        for bad in [[],42,{'nickname':'x'*41},{'bio':'x'*501},{'nickname':False},{'nickname':'bad\x00name'},{'avatar_asset_id':False},{'avatar_url':'https://untrusted.test/x'},{'user_id':bid}]:
            assert req('/me/profile',bad,alice,method='PATCH')[0]==400,bad
        for cookie,expected in [(alice,200),(bob,404),('',401)]:
            request=urllib.request.Request(f'http://127.0.0.1:{port}/api/v1/uploads/private-avatar',headers={'Cookie':cookie})
            try:r=urllib.request.urlopen(request,timeout=5)
            except urllib.error.HTTPError as e:r=e
            with r:assert r.status==expected,(r.status,expected)
        # Count only caller-owned active records across multiple worlds.
        j,_=create(req,alice,'personal-root');root=terminal(req,alice,j)['version_id']
        j,_=create(req,alice,'personal-child',root);child=terminal(req,alice,j)['version_id']
        j,_=create(req,alice,'personal-second');second=terminal(req,alice,j)['version_id']
        j,_=create(req,bob,'other-root');other=terminal(req,bob,j)['version_id']
        assert req('/me/drafts',{'text':'private draft'},alice)[0]==200
        with sqlite3.connect(db) as conn:
            conn.execute("UPDATE versions SET data=json_set(data,'$.source_id','HIDDEN_SOURCE','$.story_memory.anchor','HIDDEN_MEMORY') WHERE id=?",(root,))
        status,summary,_=req('/me/creator-summary',cookie=alice)
        assert status==200 and summary['scope']=='private_owned' and summary['community_enabled'] is False
        assert summary['stats']['worlds']==2 and summary['stats']['works']==3 and summary['stats']['drafts']==1
        dumped=json.dumps(summary)
        assert 'HIDDEN_SOURCE' not in dumped and 'HIDDEN_MEMORY' not in dumped and 'personal-alice@local.test' not in dumped and other not in dumped
        for v in summary['recent_versions']:
            assert not ({'source_id','source_url','story_memory','email','engine'} & v.keys()),v
        original_artwork=req('/versions/'+root,cookie=alice)[1]
        motion='/versions/'+root+'/motion-preference'
        assert req(motion,cookie=bob)[0]==404
        assert req(motion,{'preset':'dynamic','custom_text':'gentle pan'},bob,method='PATCH')[0]==404
        status,m,_=req(motion,{'preset':'custom','custom_text':'slow camera movement'},alice,method='PATCH')
        assert status==200 and m['preset']=='custom' and m['custom_text']=='slow camera movement',m
        assert m['generation_enabled'] is False
        assert req('/versions/'+root,cookie=alice)[1]==original_artwork
        for bad in [[],{'preset':'invalid'},{'preset':False},{'custom_text':'x'*501},{'enabled':True},{'version_id':other}]:
            assert req(motion,bad,alice,method='PATCH')[0]==400,bad
        # Local appeal is a private stored request, never real moderation approval.
        assert req('/me/appeals',{'version_id':root,'reason':'Other owner'},bob)[0]==404
        for bad in [[],{'version_id':root,'reason':''},{'version_id':root,'reason':'x'*2001},{'version_id':root,'reason':'x','status':'approved'}]:
            assert req('/me/appeals',bad,alice)[0]==400,bad
        status,appeal,_=req('/me/appeals',{'version_id':root,'reason':'Please review this local fixture'},alice)
        assert status==200 and appeal['status']=='pending_local' and appeal['processing_enabled'] is False
        assert req('/me/appeals',cookie=bob)[1]['items']==[]
        assert req('/versions/'+root+'/export-permission',cookie=alice)[1]['allowed'] is False
        assert req('/versions/'+root,None,alice,method='DELETE')[0]==200
        assert req(motion,cookie=alice)[0]==404 and req(motion,{'preset':'gentle'},alice,method='PATCH')[0]==404
        assert req('/me/appeals',{'version_id':root,'reason':'Trashed owned work'},alice)[0]==200
        summary=req('/me/creator-summary',cookie=alice)[1]
        assert summary['stats']['works']==2 and summary['stats']['worlds']==2 and summary['stats']['trashed_works']==1
        assert all(v['id']!=root for v in summary['recent_versions'])
        assert req('/versions/'+root+'/restore',{},alice)[0]==200
        assert req(motion,cookie=alice)[1]['preset']=='custom'
        assert req('/versions/'+root+'/export-permission',cookie=alice)[1]['allowed'] is False
        status,settings,_=req('/me/settings',{'locale':'en-US','notifications_enabled':True},alice,method='PATCH')
        assert status==200 and settings['locale']=='en' and settings['notifications_enabled'] is True
        assert req('/me/settings',cookie=bob)[1]['notifications_enabled'] is False
        assert req('/me/settings',{'notifications_enabled':'yes'},alice,method='PATCH')[0]==400
        status,quota,_=req('/me/video-credits',cookie=alice)
        assert status==200 and quota['enabled'] is False and quota['available_now']==0 and quota['accounting_active'] is False and quota['paid_entitlements'] is False
        assert quota['timezone']=='UTC' and int(time.time())<quota['next_reset_at']<=int(time.time())+86400
        assert quota['next_reset_at']%86400==0 and quota['unavailable_reason']=='VIDEO_UNAVAILABLE'
        assert req('/generation-jobs',{'kind':'video','parent_version_id':root},alice,'disabled-video')[0]==503
        # Test local record ceiling without a hundred side-effect requests.
        with sqlite3.connect(db) as conn:
            count=conn.execute('SELECT count(*) FROM appeals WHERE user_id=?',(aid,)).fetchone()[0]
            for i in range(100-count):conn.execute('INSERT INTO appeals VALUES(?,?,?,?,?)',('appeal-cap-'+str(i),aid,root,'local fixture',int(time.time())))
        assert req('/me/appeals',{'version_id':root,'reason':'Over cap'},alice)[0]==409
        assert req('/me/profile',{'avatar_asset_id':None},alice,method='PATCH')[1]['avatar_url'] is None
        print('PASS: private profiles/avatar ownership, field limits, owned aggregate projections, deleted-work motion denial, local-only appeals/cap, HOLD export, preference isolation, truthful disabled quota/reset')

if __name__=='__main__':main()
