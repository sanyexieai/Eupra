#!/usr/bin/env python3
"""Real Chromium regression + responsive captures, intended for supported local/CI runners.

No provider credentials required: explicitly opt-in template-text demo mode. Never a
live-image, production safety, or production share acceptance test. Server responses
are not mocked. Requires built Rust binary, npm install, Python Playwright/Chromium.
"""
from pathlib import Path
import os, subprocess, tempfile, time, urllib.request, uuid, json, sys, struct
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'qa'/'artifacts'; ART.mkdir(exist_ok=True)
MODE=sys.argv[1] if len(sys.argv)>1 else 'demo'
assert MODE in ('demo','unavailable'), 'Expected demo or unavailable'
BASE='http://127.0.0.1:5173'
checks=[]; captures=[]
def passed(label):
 checks.append(label); print('PASS',label,flush=True)
def ready(url):
 for _ in range(250):
  try: urllib.request.urlopen(url); return
  except Exception: time.sleep(.1)
 raise RuntimeError('Server did not become ready: '+url)
log=open(ART/('servers-'+MODE+'.log'),'w')
tmp=tempfile.TemporaryDirectory(prefix='eupra-browser-')
env=dict(os.environ,EUPRA_PROVIDER=MODE,EUPRA_DATABASE=str(Path(tmp.name)/'db.sqlite3'),EUPRA_MEDIA_DIR=str(Path(tmp.name)/'media'),EUPRA_BIND='127.0.0.1:8787',EUPRA_LOCAL_REVIEW='1' if MODE=='demo' else '0')
backend=subprocess.Popen([str(ROOT/'backend/target/debug/eupra-api')],env=env,stdout=log,stderr=log)
frontend=subprocess.Popen(['npm','run','dev','--','--host','127.0.0.1','--strictPort'],cwd=ROOT/'frontend',stdout=log,stderr=log,start_new_session=True)
try:
 ready('http://127.0.0.1:8787/api/v1/config'); ready(BASE)
 with sync_playwright() as p:
  executable=os.environ.get('EUPRA_CHROMIUM_EXECUTABLE')
  launch={'headless':True,'args':['--no-sandbox']}
  if executable: launch['executable_path']=executable
  elif Path('/usr/bin/chromium').exists(): launch['executable_path']='/usr/bin/chromium'
  browser=p.chromium.launch(**launch)
  context=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
  page=context.new_page(); errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   page.goto(BASE); page.wait_for_selector('.hero')
   assert page.locator('h1').count()==1; passed('WEB-01 landing renders')
   page.get_by_role('button',name='界面语言').click()
   page.get_by_role('heading',name='Live the impossible.').wait_for()
   passed('language switches landing to English')
   page.goto(BASE+'/welcome'); page.wait_for_selector('.welcome-portal')
   assert page.locator('.hero').count()==0
   page.get_by_role('button',name='Write a thought').click()
   page.wait_for_url('**/create')
   field=page.get_by_role('textbox',name='Text',exact=True)
   field.fill('Another meeting that could have been an email.')
   page.get_by_role('button',name='Interface language').click()
   assert page.get_by_role('textbox',name='文字',exact=True).input_value()=='Another meeting that could have been an email.'
   page.get_by_role('button',name='界面语言').click()
   passed('CN-01 distinct welcome shortcut and locale-preserved text draft')
   page.get_by_role('button',name='Log in',exact=True).click()
   page.get_by_role('dialog').wait_for(); page.keyboard.press('Escape')
   assert page.get_by_role('dialog').count()==0; passed('authentication Escape dismisses dialog')
   page.get_by_role('button',name='Log in',exact=True).click()
   dialog=page.get_by_role('dialog')
   dialog.get_by_role('button',name='Create account',exact=True).click()
   page.get_by_label('Email',exact=True).fill('browser-'+uuid.uuid4().hex[:12]+'@example.test')
   page.get_by_label('Password (at least 10 characters)',exact=True).fill('local-test-password-42!')
   dialog.get_by_role('button',name='Create account',exact=True).click()
   page.wait_for_function("!document.querySelector('[role=dialog]')")
   assert field.input_value()=='Another meeting that could have been an email.'
   passed('real registration preserves creation draft')
   root_id=None; child_id=None; world_id=None; token=None; cancelled_job=None
   if MODE=='demo':
    page.get_by_role('button',name='Let it happen',exact=True).click()
    page.wait_for_url('**/result/**',timeout=20000)
    root_id=page.url.rsplit('/',1)[1]
    page.get_by_text('Text concept demo · No image generated',exact=True).first.wait_for()
    assert page.locator('.result-art > img').count()==0
    passed('CN-02→03→04 real API text-demo job, no invented image')
    root_version=page.request.get(BASE+'/api/v1/versions/'+root_id).json()
    world_id=root_version['story_world_id']
    page.get_by_role('link',name='Push it further',exact=True).click()
    page.wait_for_selector('.version-strip button')
    page.get_by_role('button',name='Push it further',exact=True).click()
    page.wait_for_url('**/result/**',timeout=20000)
    child_id=page.url.rsplit('/',1)[1]
    child=page.request.get(BASE+'/api/v1/versions/'+child_id).json()
    assert child_id!=root_id and child['parent_version_id']==root_id
    passed('CN-05 continuation creates immutable child with accurate parent')
    page.goto(BASE+'/works'); page.wait_for_selector('.work-card')
    assert page.locator('.work-card').count()==2
    page.get_by_role('button',name='Remixes',exact=True).click()
    assert page.locator('.work-card').count()==1
    page.get_by_role('button',name='Favorite creation',exact=True).click()
    page.get_by_role('button',name='Remove favorite',exact=True).wait_for()
    page.get_by_role('button',name='Favorites',exact=True).click()
    assert page.locator('.work-card').count()==1
    page.get_by_role('searchbox',name='Search your creations').fill('impossible-search-no-match')
    page.get_by_text('No matching versions',exact=True).wait_for()
    page.reload(); page.wait_for_selector('.work-card')
    page.get_by_role('button',name='Favorites',exact=True).click()
    assert page.locator('.work-card').count()==1
    passed('CN-08 filters/search and favorite survives reload')
    page.goto(BASE+'/worlds/'+world_id); page.wait_for_selector('.timeline-node')
    assert page.locator('.timeline-node').count()==2
    strip=page.get_by_role('group',name='Browse story versions')
    strip.get_by_role('button').first.click()
    expect(strip.get_by_role('button').first).to_have_attribute('aria-pressed','true')
    expect(page.locator('.world-context').get_by_role('link',name='Push it further',exact=True)).to_have_attribute('href','/remix/'+root_id)
    expect(page).to_have_url(BASE+'/worlds/'+world_id+'?version='+root_id)
    passed('CN-10 historical node selection preserves branch target')
    page.goto(BASE+'/share/'+root_id)
    create=page.get_by_role('button',name='Create local preview link')
    create.wait_for(); assert not create.is_enabled()
    page.get_by_role('checkbox').check(); create.click()
    page.get_by_role('link',name='Open local preview').wait_for()
    share_url=page.get_by_role('link',name='Open local preview').get_attribute('href')
    token=share_url.rsplit('/',1)[1]
    assert page.get_by_text('This creation is on safety hold.',exact=False).count()>0
    passed('CN-06 local text review required; production HOLD unchanged')
    guest=browser.new_context(viewport={'width':390,'height':844})
    gp=guest.new_page(); gp.goto(share_url)
    gp.get_by_role('button',name='再离谱点',exact=True).wait_for()
    assert gp.locator('.public-share .version-visual').count()==1
    safe=gp.request.get(BASE+'/api/v1/share/'+token).json()['version']
    assert 'source_id' not in safe and 'story_memory' not in safe
    gp.get_by_role('button',name='再离谱点',exact=True).click()
    gp.get_by_role('dialog').wait_for()
    passed('CN-07 unauthenticated safe preview; remix retains capability and asks login')
    guest.close()
    cancel_response=page.request.post(BASE+'/api/v1/generation-jobs',headers={'Idempotency-Key':uuid.uuid4().hex},data={'kind':'first_twist','text':'Cancellation regression case','locale':'en'})
    assert cancel_response.ok
    cancellation_candidate=cancel_response.json()['id']
    cancelled=page.request.post(BASE+'/api/v1/generation-jobs/'+cancellation_candidate+'/cancel').json()
    if cancelled.get('status')=='cancelled':
     cancelled_job=cancellation_candidate
     passed('CN-03 real queued demo task cancelled without result version')
    else:
     print('NOTE cancellation timing lost race; CN-03 separate screenshot not claimed',flush=True)
   else:
    page.get_by_role('button',name='Let it happen',exact=True).click()
    page.get_by_role('status').get_by_text('Generation is not configured yet.',exact=False).wait_for()
    assert '/create' in page.url
    assert page.request.get(BASE+'/api/v1/me/works').json()['items']==[]
    passed('unconfigured service refuses generation and produces no version')
 
   routes=[('WEB-01','/','.hero'),('CN-01','/welcome','.welcome-portal'),('CN-02','/create','.workbench'),('CN-08','/works','.page'),('CN-11','/settings','.pp-profile'),('CN-13','/balance','.pp-balance'),('design-example','/examples/ceo','.result-art')]
   if root_id:
    routes += [('CN-04','/result/'+root_id,'.result-art'),('CN-05','/remix/'+root_id,'.version-strip'),('CN-06','/share/'+root_id,'.share-preview'),('CN-07','/s/'+token,'.public-share'),('CN-09','/versions/'+root_id,'.detail-lineage'),('CN-10','/worlds/'+world_id,'.world-overview'),('CN-12','/video/'+root_id,'.pp-video')]
   if cancelled_job: routes.append(('CN-03-cancelled','/jobs/'+cancelled_job,'.job-page'))
   for language in ['en-US','zh-CN']:
    current_language=page.locator('html').get_attribute('lang')
    if current_language!=language:
     page.get_by_role('button',name='Interface language' if current_language=='en-US' else '界面语言',exact=True).click()
    for size,viewport in [('desktop',{'width':1440,'height':1000}),('mobile',{'width':390,'height':844})]:
     page.set_viewport_size(viewport)
     for label,path,selector in routes:
      page.goto(BASE+path); page.wait_for_selector(selector)
      assert page.locator('html').get_attribute('lang')==language
      page.evaluate("Promise.all(Array.from(document.images).map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r})))")
      assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'),f'Horizontal overflow: {label} {size} {language}'
      filename=f'{label}-{size}-{language}-{MODE}.png'
      page.screenshot(path=str(ART/filename),full_page=True)
      captures.append({'page':label,'viewport':size,'locale':language,'file':filename})
   passed('all captured personal-core routes render in Chinese and English without horizontal overflow at 1440px and 390px')
   if MODE=='demo':
    page.goto(BASE+'/create')
    page.get_by_role('button',name='文字',exact=True).click()
    page.get_by_role('textbox',name='文字',exact=True).fill('今天又开了一场本来可以发邮件的会议。')
    page.get_by_role('button',name='让它发生点什么',exact=True).click()
    page.wait_for_url('**/result/**',timeout=20000)
    chinese_id=page.url.rsplit('/',1)[1]
    chinese=page.request.get(BASE+'/api/v1/versions/'+chinese_id).json()
    assert chinese['title']=='日常事务正式提出异议' and chinese['demo'] is True and chinese['image_url'] is None
    page.get_by_text('文字概念演示 · 尚未生成图片',exact=True).first.wait_for()
    filename='CN-04-Chinese-input-mobile-zh-CN-demo.png'
    page.screenshot(path=str(ART/filename),full_page=True)
    captures.append({'page':'CN-04-Chinese-input','viewport':'mobile','locale':'zh-CN','file':filename})
    passed('Chinese text creation produces correctly localized explicit demo result')
   page.get_by_role('button',name='界面语言',exact=True).click()
   # The example poster is an actual downloadable PNG, with visible design-example labels.
   page.goto(BASE+'/examples/ceo')
   with page.expect_download() as download_info:
    page.get_by_role('button',name='Download example poster',exact=True).click()
   download=download_info.value
   poster=ART/('official-design-example-poster-'+MODE+'.png')
   download.save_as(str(poster)); payload=poster.read_bytes()
   assert payload[:8]==b'\x89PNG\r\n\x1a\n'
   assert struct.unpack('>II',payload[16:24])==(1080,1350)
   passed('official-example poster downloads an actual 1080×1350 PNG')
   # Actual supplied sources populate the creation draft; SVG sources rasterize locally.
   page.goto(BASE+'/create'); page.get_by_role('button',name='Photo',exact=True).click()
   for label,source in [('My cat','example-cat.jpg'),('Everyday run','example-run.svg'),('Impossible trip','example-world.svg')]:
    sample_button=page.get_by_role('button',name=label,exact=True)
    sample_button.evaluate("el=>el.scrollIntoView({block:'center',inline:'nearest'})")
    page.wait_for_timeout(100)
    assert sample_button.evaluate("el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!hit&&(el===hit||el.contains(hit))}"),f'Sample covered by overlay: {label}'
    sample_button.click()
    page.wait_for_function("source=>document.querySelector('.dropzone.has-image > img')?.getAttribute('src')?.endsWith(source)",arg=source)
   passed('all three original input samples select actual source assets')
   page.locator('.cp-samples').scroll_into_view_if_needed()
   page.screenshot(path=str(ART/('CN-02-mobile-samples-viewport-'+MODE+'.png')),full_page=False)
   footer_link=page.locator('footer').get_by_role('link',name='Account & settings',exact=True)
   footer_link.evaluate("el=>el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'})")
   page.evaluate("()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))")
   assert footer_link.evaluate("el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!hit&&(el===hit||el.contains(hit))}"),'Footer control covered by overlay'
   footer_link.click(); page.wait_for_url('**/settings')
   passed('scrolled sample buttons and final footer control are hit-test accessible')
   page.goto(BASE+'/create'); page.get_by_role('button',name='Photo',exact=True).click()
   page.get_by_label('Capture or choose a camera photo').set_input_files(str(ROOT/'frontend/public/assets/demo-source.webp'))
   page.wait_for_function("document.querySelector('.dropzone.has-image > img')?.getAttribute('src')?.startsWith('blob:')")
   passed('camera fallback accepts an actual selected image file')
   # Verify actual upload preview is retained across locale switch. No generation is requested.
   page.goto(BASE+'/create'); page.get_by_role('button',name='Photo',exact=True).click()
   page.get_by_label('Choose a photo').set_input_files(str(ROOT/'frontend/public/assets/demo-source.webp'))
   source=page.locator('.dropzone.has-image > img').get_attribute('src')
   page.get_by_role('button',name='Interface language').click()
   assert page.locator('.dropzone.has-image > img').get_attribute('src')==source
   passed('local photo preview survives language change')
   assert not errors,errors; passed('no browser JavaScript runtime errors')
  except Exception as exc:
   # Only URL path and sanitized exception type are retained; never cookies/password fields.
   try:
    page.locator('input[type=password],input[type=email],input.share-url').evaluate_all("els=>els.forEach(el=>el.value='')")
    page.screenshot(path=str(ART/('failure-'+MODE+'.png')),full_page=True)
   except Exception: pass
   from urllib.parse import urlparse
   path=urlparse(page.url).path
   if path.startswith('/s/'): path='/s/[capability-redacted]'
   (ART/('failure-'+MODE+'.json')).write_text(json.dumps({'path':path,'error_type':type(exc).__name__,'checks_passed':checks},indent=2))
   raise
  browser.close()
 result={'mode':MODE,'checks':checks,'captures':captures,'limits':['Explicit local template demo only; not live image generation.','CN-03 live transition exercised; separate terminal-cancel screenshot only when actual cancellation wins the worker race.','Production sharing/export remains held.']}
 (ART/('browser-'+MODE+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2))
 print(json.dumps(result,ensure_ascii=False),flush=True)
finally:
 backend.terminate()
 try: os.killpg(frontend.pid,15)
 except ProcessLookupError: pass
 try: backend.wait(timeout=5)
 except subprocess.TimeoutExpired: backend.kill()
 log.close(); tmp.cleanup()
