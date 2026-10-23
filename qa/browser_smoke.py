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
def reveal(page, chinese=False):
 page.get_by_role('button',name='看看发生了什么' if chinese else 'Reveal this version',exact=True).wait_for(timeout=20000)
 assert '/jobs/' in page.url, 'Success must remain in the theater until deliberate reveal'
 language=page.locator('html').get_attribute('lang'); width=page.viewport_size['width']
 page.screenshot(path=str(ART/f'CN-03-ready-{width}px-{language}-{MODE}.png'),full_page=True)
 page.get_by_role('button',name='看看发生了什么' if chinese else 'Reveal this version',exact=True).click()
 page.wait_for_url('**/result/**',timeout=20000)
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
   expect(page.locator('h1')).to_have_count(1); passed('WEB-01 landing renders')
   page.get_by_role('button',name='界面语言').click()
   page.get_by_role('heading',name='Live the impossible.').wait_for()
   passed('language switches landing to English')
   player=page.get_by_label('Pre-made five-second design demonstration',exact=True)
   expect(player.locator('source').first).to_have_attribute('src','/assets/cn12_cinematic_demo_5s_en.webm')
   page.get_by_role('button',name='Play design video',exact=True).click()
   page.wait_for_function("el => el.currentTime > 0.1",arg=player.element_handle())
   player.evaluate('el=>el.pause()')
   passed('WEB-01 original design video actually plays with explicit pre-made labeling')
   page.locator('.story-card').first.click()
   example_sheet=page.get_by_role('dialog')
   expect(example_sheet.locator('.source-sheet-image')).to_have_attribute('src','/assets/demo-source.webp')
   for filename in ['cat-ceo-hero.webp','cat-moon-hero.webp','shiba-agent.webp']:
    example_sheet.get_by_role('button',name='Next example',exact=True).click()
    expect(example_sheet.locator('.source-sheet-image')).to_have_attribute('src','/assets/'+filename)
   page.screenshot(path=str(ART/('WEB-01-example-sheet-desktop-en-US-'+MODE+'.png')),full_page=True)
   page.keyboard.press('Escape'); expect(example_sheet).to_have_count(0)
   passed('WEB-01 actual sample source and three labeled original examples switch without creating personal work')
   page.goto(BASE+'/welcome'); page.wait_for_selector('.welcome-portal')
   expect(page.locator('.hero')).to_have_count(0)
   for input_label in ['Choose a welcome photo','Capture a welcome photo']:
    page.get_by_label(input_label,exact=True).set_input_files(str(ROOT/'frontend/public/assets/demo-source.webp'))
    page.wait_for_url('**/create')
    page.wait_for_function("document.querySelector('.dropzone.has-image > img')?.getAttribute('src')?.startsWith('blob:')")
    page.goto(BASE+'/welcome'); page.wait_for_selector('.welcome-portal')
   passed('CN-01 actual upload and camera-file intents preserve source into creation')
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
   page.get_by_role('button',name='Save private draft',exact=True).click()
   page.get_by_text('Private draft saved.',exact=True).wait_for()
   drafts=page.request.get(BASE+'/api/v1/me/drafts').json()['items']
   assert len(drafts)==1 and drafts[0]['text']=='Another meeting that could have been an email.'
   saved_draft_id=drafts[0]['id']
   page.goto(BASE+'/create?draft='+saved_draft_id)
   expect(page.get_by_role('textbox',name='Text',exact=True)).to_have_value('Another meeting that could have been an email.')
   page.reload()
   expect(page.get_by_role('textbox',name='Text',exact=True)).to_have_value('Another meeting that could have been an email.')
   passed('private draft saves through real API and restores exact text after reload')
   root_id=None; child_id=None; world_id=None; token=None; cancelled_job=None
   if MODE=='demo':
    page.get_by_role('button',name='Let it happen',exact=True).click()
    reveal(page)
    root_id=page.url.rsplit('/',1)[1]
    page.get_by_text('Text concept demo · No image generated',exact=True).first.wait_for()
    expect(page.locator('.result-art > img')).to_have_count(0)
    passed('CN-02→03→04 real API text-demo job, no invented image')
    page.get_by_role('button',name='View actual source',exact=True).click()
    source_sheet=page.get_by_role('dialog',name='View actual source',exact=True)
    source_sheet.get_by_text('Another meeting that could have been an email.',exact=True).wait_for()
    page.screenshot(path=str(ART/'CN-04-source-sheet-desktop-en-US-demo.png'),full_page=True)
    page.keyboard.press('Escape'); expect(source_sheet).to_have_count(0)
    expect(page).to_have_url(BASE+'/result/'+root_id)
    passed('CN-04 actual private source sheet shows full original input and closes without changing version')
    root_version=page.request.get(BASE+'/api/v1/versions/'+root_id).json()
    world_id=root_version['story_world_id']
    page.get_by_role('button',name='Push it further',exact=True).click()
    reveal(page)
    child_id=page.url.rsplit('/',1)[1]
    child=page.request.get(BASE+'/api/v1/versions/'+child_id).json()
    assert child_id!=root_id and child['parent_version_id']==root_id
    passed('CN-04 one-action continuation creates immutable child with accurate parent and deliberate reveal')
    page.goto(BASE+'/result/'+root_id)
    page.get_by_role('button',name='Browse existing branches',exact=True).click()
    page.locator('.inline-branches .version-strip button').first.wait_for()
    page.screenshot(path=str(ART/'CN-04-expanded-branches-desktop-en-US-demo.png'),full_page=True)
    page.locator('.inline-branches .version-strip button').first.click()
    expect(page).to_have_url(BASE+'/result/'+child_id)
    page.get_by_role('link',name='Choose a direction and version',exact=True).click()
    page.wait_for_selector('.version-strip button')
    page.get_by_role('link',name='Return to selected result',exact=True).click()
    expect(page).to_have_url(BASE+'/result/'+child_id)
    passed('CN-04/05 actual inline child browsing and selected-version result return')
    page.goto(BASE+'/works'); page.wait_for_selector('.work-card')
    expect(page.locator('.work-card')).to_have_count(2)
    page.get_by_role('button',name='Remixes',exact=True).click()
    expect(page.locator('.work-card')).to_have_count(1)
    page.get_by_role('button',name='Favorite creation',exact=True).click()
    page.get_by_role('button',name='Remove favorite',exact=True).wait_for()
    page.get_by_role('button',name='Favorites',exact=True).click()
    expect(page.locator('.work-card')).to_have_count(1)
    page.get_by_role('searchbox',name='Search your creations').fill('impossible-search-no-match')
    page.get_by_text('No matching versions',exact=True).wait_for()
    page.reload(); page.get_by_text('No matching versions',exact=True).wait_for()
    expect(page.get_by_role('searchbox',name='Search your creations')).to_have_value('impossible-search-no-match')
    page.get_by_role('searchbox',name='Search your creations').fill('')
    page.wait_for_selector('.work-card')
    expect(page.locator('.work-card')).to_have_count(1)
    own_world=next(w for w in page.request.get(BASE+'/api/v1/me/story-worlds').json()['items'] if w['id']==world_id)
    page.get_by_role('searchbox',name='Search your creations').fill(own_world['title'])
    expect(page.locator('.work-card')).to_have_count(1)
    page.get_by_role('searchbox',name='Search your creations').fill('')
    passed('CN-08 world-name search, filter/query reload and favorite persistence')
    page.get_by_role('button',name='Drafts',exact=True).click()
    page.locator('.dl-item').get_by_role('link',name='Continue editing',exact=True).wait_for()
    page.screenshot(path=str(ART/'CN-08-draft-tab-desktop-en-US-demo.png'),full_page=True)
    page.get_by_role('button',name='All',exact=True).click()
    expect(page.locator('.work-card')).to_have_count(2)
    page.locator('.work-card').first.get_by_role('button',name='Work details:',exact=False).click()
    work_sheet=page.get_by_role('dialog',name='Work details',exact=True)
    work_sheet.get_by_role('link',name='Share and export',exact=True).wait_for()
    assert work_sheet.get_by_role('link',name='Share and export',exact=True).get_attribute('href').startswith('/share/')
    page.screenshot(path=str(ART/'CN-08-work-drawer-desktop-en-US-demo.png'),full_page=True)
    page.keyboard.press('Escape'); expect(work_sheet).to_have_count(0)
    expect(page.locator('.work-card')).to_have_count(2)
    passed('CN-08 first-class drafts and actual work drawer preserve library context and gated sharing')
    page.goto(BASE+'/worlds/'+world_id); page.wait_for_selector('.timeline-node')
    expect(page.locator('.timeline-node')).to_have_count(2)
    strip=page.get_by_role('group',name='Browse story versions')
    strip.get_by_role('button').first.click()
    expect(strip.get_by_role('button').first).to_have_attribute('aria-pressed','true')
    expect(page.locator('.world-context').get_by_role('link',name='Push it further',exact=True)).to_have_attribute('href','/remix/'+root_id)
    expect(page).to_have_url(BASE+'/worlds/'+world_id+'?version='+root_id)
    passed('CN-10 historical node selection preserves branch target')
    page.get_by_role('button',name='Creator lineage',exact=True).click()
    lineage_sheet=page.get_by_role('dialog',name='Creator lineage',exact=True)
    lineage_sheet.wait_for(); page.screenshot(path=str(ART/'CN-10-lineage-sheet-desktop-en-US-demo.png'),full_page=True)
    page.keyboard.press('Escape'); expect(lineage_sheet).to_have_count(0)
    page.get_by_role('button',name='Continue selected version',exact=True).click()
    reveal(page)
    selected_child=page.request.get(BASE+'/api/v1/versions/'+page.url.rsplit('/',1)[1]).json()
    assert selected_child['parent_version_id']==root_id
    passed('CN-10 lineage sheet closes and persistent action creates a real child of the selected historical node')
    page.set_viewport_size({'width':390,'height':844})
    page.goto(BASE+'/versions/'+root_id)
    detail_continue=page.get_by_role('button',name='Continue selected version',exact=True)
    detail_continue.wait_for()
    page.evaluate('window.scrollTo(0,document.body.scrollHeight)')
    detail_continue.scroll_into_view_if_needed()
    assert detail_continue.evaluate('el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}')
    page.screenshot(path=str(ART/'CN-09-sticky-action-mobile-en-US-demo.png'),full_page=True)
    detail_continue.click(); reveal(page)
    detail_child=page.request.get(BASE+'/api/v1/versions/'+page.url.rsplit('/',1)[1]).json()
    assert detail_child['parent_version_id']==root_id
    page.set_viewport_size({'width':1440,'height':1000})
    passed('CN-09 mobile persistent action is hit-test accessible and continues the actual selected detail version')
    page.goto(BASE+'/share/'+root_id)
    create=page.get_by_role('button',name='Create local preview link')
    create.wait_for(); assert not create.is_enabled()
    page.get_by_role('checkbox').check(); create.click()
    page.get_by_role('link',name='Open local preview').wait_for()
    share_url=page.get_by_role('link',name='Open local preview').get_attribute('href')
    token=share_url.rsplit('/',1)[1]
    assert page.get_by_text('This creation is on safety hold.',exact=False).count()>0
    passed('CN-06 local text review required; production HOLD unchanged')
    page.get_by_text('Sharing to other apps',exact=True).click()
    page.get_by_text('WeChat / Moments',exact=True).wait_for()
    page.get_by_text('This personal poster is not authorized for export, so there is no image to save or upload yet. Complete independent output review and export setup first.',exact=True).wait_for()
    passed('CN-06 platform guidance explains manual steps and blocked export without pretending a post succeeded')
    guest=browser.new_context(viewport={'width':390,'height':844})
    gp=guest.new_page(); gp.goto(share_url)
    gp.get_by_role('button',name='再离谱点',exact=True).wait_for()
    expect(gp.locator('.public-share > .version-visual')).to_have_count(1)
    expect(gp.locator('.sp-comparison article')).to_have_count(2)
    assert gp.locator('.sp-comparison a').count()==0
    safe=gp.request.get(BASE+'/api/v1/share/'+token).json()['version']
    assert 'source_id' not in safe and 'story_memory' not in safe
    gp.get_by_role('button',name='再离谱点',exact=True).click()
    gp.get_by_role('dialog').wait_for()
    passed('CN-07 unauthenticated safe preview; remix retains capability and asks login')
    guest.close()
    page.goto(share_url)
    own_export=page.get_by_role('link',name='Save or share your version',exact=True)
    own_export.wait_for()
    chosen_id=own_export.get_attribute('href').rsplit('/',1)[1]
    assert page.request.get(BASE+'/api/v1/versions/'+chosen_id).json()['parent_version_id']==root_id
    page.screenshot(path=str(ART/'CN-07-own-child-comparison-desktop-en-US-demo.png'),full_page=True)
    passed('CN-07 compares only an actual owned child and routes save/share to its gated export')
    intercepted=[]
    def cancel_real_shared_job(route):
     response=route.fetch()
     if response.ok:
      value=response.json(); cancelled_response=page.request.post(BASE+'/api/v1/generation-jobs/'+value['id']+'/cancel')
      intercepted.append((value['id'],cancelled_response.json()['status']))
     route.fulfill(response=response)
    page.route('**/api/v1/generation-jobs',cancel_real_shared_job)
    page.get_by_role('button',name='Push it further',exact=True).click()
    page.get_by_role('button',name='Retry original input',exact=True).wait_for()
    page.unroute('**/api/v1/generation-jobs',cancel_real_shared_job)
    assert intercepted and intercepted[0][1]=='cancelled'
    page.reload()
    page.get_by_role('button',name='Retry original input',exact=True).wait_for()
    page.goto(share_url)
    page.get_by_role('link',name='Save or share your version',exact=True).wait_for()
    page.get_by_role('link',name='Return to creation or resume your last task',exact=True).click()
    page.locator('a.resume').click()
    expect(page).to_have_url(BASE+'/jobs/'+intercepted[0][0])
    page.get_by_role('button',name='Retry original input',exact=True).click()
    reveal(page)
    retried_shared=page.request.get(BASE+'/api/v1/versions/'+page.url.rsplit('/',1)[1]).json()
    assert retried_shared['parent_version_id']==root_id
    passed('CN-03 cancelled shared continuation retries original request with valid memory-held capability and exact parent')
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
    reveal(page,chinese=True)
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
   if root_id:
    before_credits=page.request.get(BASE+'/api/v1/me/video-credits').json()
    page.goto(BASE+'/video/'+root_id)
    page.get_by_role('button',name='Watch the local design demo',exact=True).click()
    demo_player=page.locator('video[aria-label="Local 5-second design demo"]')
    page.get_by_role('button',name='Play design demo',exact=True).click()
    page.wait_for_function('el => el.currentTime > 0.1',arg=demo_player.element_handle())
    demo_player.evaluate('el=>el.pause()')
    assert page.request.get(BASE+'/api/v1/me/video-credits').json()==before_credits
    passed('CN-12 labeled original design video plays without spending credits')
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
   # Sample selection shows a dismissible confirmation toast above app navigation.
   # Exercise its visible close control before testing the underlying account-navigation target.
   sample_notice=page.locator('.toast[role=status]')
   expect(sample_notice).to_be_visible()
   sample_notice.get_by_role('button',name='Close',exact=True).click()
   expect(sample_notice).to_have_count(0)
   passed('sample confirmation notice can be dismissed before accessing account navigation')
   footer_link=page.locator('.mobile-nav').get_by_role('link',name='Account & settings',exact=True)
   footer_link.evaluate("el=>el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'})")
   page.evaluate("()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))")
   assert footer_link.evaluate("el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!hit&&(el===hit||el.contains(hit))}"),'Account navigation covered by overlay'
   footer_link.click(); page.wait_for_url('**/settings')
   passed('scrolled sample buttons and account navigation are hit-test accessible')
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
   page.get_by_role('button',name='界面语言',exact=True).click()
   page.goto(BASE+'/works')
   library=page.locator('.dl-library')
   library.locator('.dl-heading').click()
   expect(library.locator('.dl-item')).to_have_count(1)
   library.get_by_role('button',name='Move to trash',exact=True).click()
   library.get_by_role('button',name='Confirm move',exact=True).click()
   library.get_by_text('No saved drafts yet',exact=True).wait_for()
   library.get_by_role('button',name='Trash',exact=True).click()
   expect(library.locator('.dl-item')).to_have_count(1)
   library.get_by_role('button',name='Restore',exact=True).click()
   library.get_by_text('Trash is empty',exact=True).wait_for()
   library.get_by_role('button',name='My drafts',exact=True).click()
   library.get_by_role('link',name='Continue editing',exact=True).click()
   expect(page).to_have_url(BASE+'/create?draft='+saved_draft_id)
   expect(page.get_by_role('textbox',name='Text',exact=True)).to_have_value('Another meeting that could have been an email.')
   passed('private draft trash and restore use real persisted state and resume original text')
   page.goto(BASE+'/create'); page.get_by_role('button',name='Photo',exact=True).click()
   page.get_by_label('Choose a photo').set_input_files(str(ROOT/'frontend/public/assets/demo-source.webp'))
   page.get_by_role('button',name='Save private draft',exact=True).click()
   page.get_by_text('Private draft saved.',exact=True).wait_for()
   photo_drafts=page.request.get(BASE+'/api/v1/me/drafts').json()['items']
   photo_draft=next(d for d in photo_drafts if d.get('source_id'))
   page.goto(BASE+'/create?draft='+photo_draft['id'])
   expect(page.locator('.dropzone.has-image > img')).to_have_attribute('src',photo_draft['source_url'])
   assert page.request.get(BASE+photo_draft['source_url']).ok
   stranger=browser.new_context()
   assert stranger.request.get(BASE+photo_draft['source_url']).status in (401,404)
   stranger.close()
   passed('photo draft reload uses actual private stored source and denies anonymous access')
   if root_id:
    page.goto(BASE+'/works'); library=page.locator('.dl-library'); library.locator('.dl-heading').click()
    library.get_by_role('button',name='Manage works',exact=True).click()
    work=library.locator('.dl-item').filter(has=page.locator('a[href="/versions/'+root_id+'"]'))
    work.get_by_role('button',name='Move to trash',exact=True).click()
    work.get_by_role('button',name='Confirm move',exact=True).click()
    expect(work).to_have_count(0)
    assert page.request.get(BASE+'/api/v1/share/'+token).status==404
    assert page.request.get(BASE+'/api/v1/versions/'+child_id).ok
    library.get_by_role('button',name='Trash',exact=True).click()
    expect(library.locator('.dl-item')).to_have_count(1)
    library.get_by_role('button',name='Restore',exact=True).click()
    library.get_by_text('Trash is empty',exact=True).wait_for()
    assert page.request.get(BASE+'/api/v1/versions/'+root_id).ok
    assert page.request.get(BASE+'/api/v1/share/'+token).status==404
    permission=page.request.get(BASE+'/api/v1/versions/'+root_id+'/export-permission').json()
    assert permission['allowed'] is False and permission['reason']=='REVIEW_NOT_CONFIGURED'
    page.goto(BASE+'/s/'+token); page.locator('.ep-unavailable').wait_for()
    passed('recoverable work deletion preserves child, revokes preview permanently, and keeps export held')
    if cancelled_job:
     page.goto(BASE+'/jobs/'+cancelled_job)
     page.get_by_role('button',name='Retry original input',exact=True).click()
     reveal(page)
     assert page.url.rsplit('/',1)[1] not in (root_id,child_id)
     passed('terminal job retry uses full server-retained source input and creates a new job')
     # Delay dispatch, not response data: the real API request is released unchanged.
     # This exercises browser history while the client cannot yet know job status.
     page.evaluate('(id)=>sessionStorage.setItem("eupra.job",id)',cancelled_job)
     page.goto(BASE+'/create'); page.locator('a.resume').wait_for()
     pending_routes=[]
     def hold_status(route): pending_routes.append(route)
     status_pattern='**/api/v1/generation-jobs/'+cancelled_job
     page.route(status_pattern,hold_status)
     page.locator('a.resume[href="/jobs/'+cancelled_job+'"]').click()
     page.locator('.job-page').wait_for()
     def reject_departure(dialog): dialog.dismiss()
     page.on('dialog',reject_departure)
     with page.expect_event('dialog') as departure:
      page.evaluate('history.back()')
     assert departure.value.type=='confirm'
     expect(page).to_have_url(BASE+'/jobs/'+cancelled_job)
     with page.expect_event('dialog') as unload:
      page.evaluate('setTimeout(()=>location.reload(),0)')
     assert unload.value.type=='beforeunload'
     expect(page).to_have_url(BASE+'/jobs/'+cancelled_job)
     page.remove_listener('dialog',reject_departure)
     assert pending_routes, 'Status request must be pending for this readiness regression'
     for held_route in pending_routes: held_route.continue_()
     page.unroute(status_pattern,hold_status)
     page.get_by_role('button',name='Retry original input',exact=True).wait_for()
     passed('CN-03 in-app Back and full-document reload are refused while genuine status request is pending; response released unchanged')

   # Real personal controls use isolated synthetic accounts, never public profile data.
   page.goto(BASE+'/settings'); page.locator('.pp-profile').wait_for()
   page.get_by_role('button',name='Edit profile',exact=True).click()
   profile_editor=page.locator('.pp-profile-editor')
   profile_editor.get_by_label('Nickname',exact=True).fill('Browser test creator')
   profile_editor.get_by_label('Bio',exact=True).fill('Synthetic private profile for regression checks.')
   profile_editor.get_by_label('Choose avatar image',exact=True).set_input_files(str(ROOT/'frontend/public/assets/demo-source.webp'))
   page.screenshot(path=str(ART/('CN-11-profile-editor-mobile-en-US-'+MODE+'.png')),full_page=True)
   profile_editor.get_by_role('button',name='Save profile',exact=True).click()
   page.get_by_role('heading',name='Browser test creator',exact=True).wait_for()
   profile=page.request.get(BASE+'/api/v1/me/profile').json()
   assert profile['bio']=='Synthetic private profile for regression checks.' and profile['avatar_url'].startswith('/api/v1/uploads/')
   anonymous=browser.new_context()
   assert anonymous.request.get(BASE+profile['avatar_url']).status in (401,404)
   anonymous.close()
   page.reload(); page.get_by_role('heading',name='Browser test creator',exact=True).wait_for()
   preference=page.get_by_role('switch',name='Local notification preference',exact=True)
   preference.check()
   page.wait_for_function("fetch('/api/v1/me/settings').then(r=>r.json()).then(s=>s.notifications_enabled===true)")
   page.reload(); expect(page.get_by_role('switch',name='Local notification preference',exact=True)).to_be_checked()
   assert page.request.get(BASE+'/api/v1/me/profile').json()['nickname']=='Browser test creator'
   passed('CN-11 private profile/avatar and local-only notification preference persist without public access')
   page.screenshot(path=str(ART/('CN-11-edited-profile-mobile-en-US-'+MODE+'.png')),full_page=True)
   if page.locator('.toast').count(): page.locator('.toast button').click()
   if MODE=='demo':
    page.get_by_role('button',name='Help and privacy',exact=True).click()
    page.get_by_label('Choose a work (all owned)',exact=True).select_option(root_id)
    page.get_by_label('Appeal reason',exact=True).fill('Synthetic appeal record; no human review requested or implied.')
    page.get_by_role('button',name='Save local appeal',exact=True).click()
    page.get_by_text('Local appeal saved. No staff processing is configured.',exact=True).wait_for()
    appeals=page.request.get(BASE+'/api/v1/me/appeals').json()
    assert appeals['processing_enabled'] is False and appeals['items'][0]['status']=='pending_local'
    assert page.request.get(BASE+'/api/v1/versions/'+root_id+'/export-permission').json()['allowed'] is False
    passed('CN-11 genuine private appeal record remains local and never authorizes export')
    page.goto(BASE+'/video/'+root_id)
    page.get_by_role('button',name='Write your own motion',exact=True).click()
    page.get_by_role('textbox',name='Write your own motion',exact=True).fill('Synthetic saved camera movement.')
    page.get_by_role('button',name='Save motion idea',exact=True).click()
    page.get_by_text('Motion idea saved for this work',exact=True).wait_for()
    page.reload()
    expect(page.get_by_role('textbox',name='Write your own motion',exact=True)).to_have_value('Synthetic saved camera movement.')
    page.screenshot(path=str(ART/'CN-12-saved-motion-mobile-en-US-demo.png'),full_page=True)
    motion=page.request.get(BASE+'/api/v1/versions/'+root_id+'/motion-preference').json()
    assert motion['preset']=='custom' and motion['generation_enabled'] is False
    credits=page.request.get(BASE+'/api/v1/me/video-credits').json()
    assert credits['successful_today']==0 and credits['available_now']==0 and credits['accounting_active'] is False
    page.goto(BASE+'/balance?version='+root_id)
    page.get_by_text('Reset timezone · UTC',exact=True).wait_for()
    passed('CN-12 motion idea survives reload; CN-13 shows actual policy reset without usable video entitlement')
    page.goto(BASE+'/worlds/'+world_id)
    page.get_by_role('button',name='Creator',exact=True).click()
    page.get_by_role('heading',name='Browser test creator',exact=True).wait_for()
    own_worlds=page.request.get(BASE+'/api/v1/me/story-worlds').json()['items']
    expect(page.locator('.creator-world-option')).to_have_count(len(own_worlds))
    assert len(own_worlds)>=2
    another=next(w for w in own_worlds if w['id']!=world_id)
    page.screenshot(path=str(ART/'CN-10-private-creator-mobile-en-US-demo.png'),full_page=True)
    page.locator('.creator-world-list a[href="/worlds/'+another['id']+'"]').click()
    expect(page).to_have_url(BASE+'/worlds/'+another['id'])
    page.locator('.world-overview').wait_for()
    passed('CN-10 private creator profile and actual account-wide world chooser navigate another owned world')
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
   media=page.locator('video').evaluate_all("els=>els.map(el=>({file:(el.currentSrc||'').split('/').pop(),readyState:el.readyState,networkState:el.networkState,errorCode:el.error?.code||null,currentTime:el.currentTime,paused:el.paused}))")
   (ART/('failure-'+MODE+'.json')).write_text(json.dumps({'path':path,'error_type':type(exc).__name__,'checks_passed':checks,'media':media},indent=2))
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
