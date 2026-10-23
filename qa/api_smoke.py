#!/usr/bin/env python3
"""Black-box API contract checks. Run against an isolated EUPRA_PROVIDER=demo server."""
import http.cookiejar, json, os, time, urllib.request, urllib.error, uuid
BASE=os.environ.get('EUPRA_TEST_API','http://127.0.0.1:8787/api/v1')
def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def request(c,path,data=None,method=None,key=None):
 headers={'Content-Type':'application/json'}
 if key:headers['Idempotency-Key']=key
 req=urllib.request.Request(BASE+path,data=None if data is None else json.dumps(data).encode(),headers=headers,method=method or ('POST' if data is not None else 'GET'))
 try:
  r=c.open(req); return r.status,json.loads(r.read())
 except urllib.error.HTTPError as e:
  raw=e.read()
  try:body=json.loads(raw)
  except Exception:body={'body':raw.decode()}
  return e.code,body

def main():
 a,b=client(),client(); checks=[]
 def check(name,expr):
  assert expr,name
  checks.append(name);print('PASS',name)
 status,config=request(a,'/config');check('config readable',status==200)
 uid=uuid.uuid4().hex[:12]
 for c,name in [(a,'a'),(b,'b')]:
  status,body=request(c,'/auth/register',{'email':f'{uid}{name}@example.test','password':'test-password-42!'})
  check('register '+name,status in (200,201))
 status,me=request(a,'/auth/me');check('session works',status==200)
 if config.get('provider')!='demo':
  status,body=request(a,'/generation-jobs',{'kind':'first_twist','text':'今天又开会了'},key=uuid.uuid4().hex)
  check('unconfigured provider fails closed',status==503)
  print(json.dumps({'checks':len(checks),'mode':config.get('provider')},ensure_ascii=False));return
 key=uuid.uuid4().hex
 status,job=request(a,'/generation-jobs',{'kind':'first_twist','text':'今天又开会了'},key=key)
 check('job accepted',status in (200,201,202))
 status,duplicate=request(a,'/generation-jobs',{'kind':'first_twist','text':'今天又开会了'},key=key)
 check('idempotent job',duplicate.get('id')==job['id'])
 check('job private',request(b,'/generation-jobs/'+job['id'])[0] in (403,404))
 deadline=time.time()+20
 while time.time()<deadline:
  _,job=request(a,'/generation-jobs/'+job['id'])
  if job['status'] in ('succeeded','failed','cancelled'):break
  time.sleep(.1)
 check('demo completes explicitly',job['status']=='succeeded' and job['demo'])
 status,v=request(a,'/versions/'+job['version_id'])
 check('root invariant',v['root_version_id']==v['id'] and v['parent_version_id'] is None)
 check('demo cannot masquerade as image',v['demo'] and v.get('image_url') is None)
 check('private version cannot leak',request(b,'/versions/'+v['id'])[0] in (403,404))
 status,body=request(a,'/share-links',{'version_id':v['id']})
 check('unreviewed output cannot be shared',status in (403,409,503))
 status,works=request(a,'/me/works');check('durable work visible',any(x['id']==v['id'] for x in works['items']))
 for branch in range(2):
  status,child=request(a,'/generation-jobs',{'kind':'continuation','parent_version_id':v['id'],'text':'分支'+str(branch)},key=uuid.uuid4().hex)
  check('branch request '+str(branch),status in (200,201,202))
  deadline=time.time()+20
  while time.time()<deadline:
   _,child=request(a,'/generation-jobs/'+child['id'])
   if child['status'] in ('succeeded','failed','cancelled'):break
   time.sleep(.1)
  check('branch completes '+str(branch),child['status']=='succeeded')
  _,cv=request(a,'/versions/'+child['version_id'])
  check('historical node branches correctly '+str(branch),cv['parent_version_id']==v['id'] and cv['root_version_id']==v['id'] and cv['story_world_id']==v['story_world_id'])
 status,children=request(a,'/versions/'+v['id']+'/children');check('two sibling branches retained',len(children['items'])==2)
 status,world=request(a,'/story-worlds/'+v['story_world_id']);check('world retains three nodes',len(world['items'])==3)
 check('world private',request(b,'/story-worlds/'+v['story_world_id'])[0] in (403,404))
 status,body=request(a,'/versions/'+v['id']+'/remix-permission',{'remix_allowed':False},method='PATCH');check('revoke remix',status==200)
 status,body=request(a,'/generation-jobs',{'kind':'continuation','parent_version_id':v['id']},key=uuid.uuid4().hex)
 check('server enforces remix revocation',status in (403,409))
 status,credits=request(a,'/me/video-credits');check('no charges for unconfigured video',credits['successful_today']==0 and credits['remaining']==2)
 status,body=request(a,'/generation-jobs',{'kind':'video','parent_version_id':v['id']},key=uuid.uuid4().hex)
 check('video unavailable is honest',status in (403,409,503))
 request(a,'/auth/logout',{});check('logout invalidates session',request(a,'/auth/me')[0]==401)
 print(json.dumps({'checks':len(checks),'mode':'demo'},ensure_ascii=False))
if __name__=='__main__':main()
