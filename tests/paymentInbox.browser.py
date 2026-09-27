"""Local production-build smoke test; every backend request is intercepted.
Run NEXT_BUILD_DIR=.next-knockoff-closure-20260911b next start --port 3142,
then python -X utf8 tests/paymentInbox.browser.py. Requires Python Playwright.
"""
import json
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect

BASE = 'http://localhost:3142'
requests = []
errors = []
uploaded = []

def respond(route):
    url = urlparse(route.request.url)
    if url.netloc == 'localhost:3142' and not url.path.startswith('/api/'):
        return route.continue_()
    requests.append(url.path + '?' + url.query)
    path = url.path
    data = {'success': True, 'data': [], 'items': [], 'total': 0, 'unread_count': 0}
    if path.endswith(('/auth/me', '/users/me')):
        data = {'success': True, 'data': {'id':14, 'email':'test@example.com', 'full_name':'Test Reviewer', 'role':'business', 'status':'active'}}
    elif path.endswith('/users/me/organizations'):
        data = {'success': True, 'data':[{'id':66, 'name':'Test organization', 'is_primary':True}]}
    elif path.endswith('/agents/runs'):
        query = parse_qs(url.query)
        pg = int(query.get('page',['1'])[0]); size = int(query.get('page_size',['50'])[0])
        rows = [] if query.get('status') else [dict(id=n, agent_id=7, user_id=14, organization_id=66,
            status='PENDING_REVIEW', agent_name='Payment Knock Off', template_key='payment_knock_off',
            source_caption=f'Review fixture {n}', source_channel='WECHAT',
            received_at='2026-09-10T09:00:00Z', updated_at='2026-09-10T09:00:00Z',
            payment_category='PENDING_SLIP',payment_flags=['CUSTOMER_CONFIRMATION_REQUIRED','PENDING_SLIP'])
            for n in range((pg-1)*size+1,min(pg*size,220)+1)]
        data = {'runs':rows,'total':0 if query.get('status') else 220}
    elif path.endswith('/payment-evidence') and route.request.method == 'POST':
        import re
        uploaded.extend(re.findall(r'filename="([^"]+)"',route.request.post_data or ''))
        n=int(path.split('/')[-2])
        data=dict(id=n,agent_id=7,user_id=14,organization_id=66,status='EXTRACTING',source_channel='WECHAT',
            review_schema={'template_key':'payment_knock_off'},
            source_caption=f'Review fixture {n}',extracted_data={'currency':'MYR','payment_slips':[],'requested_invoices':[]},
            output_refs={'payment_analysis_job_id':99,'supplemental_source_files':[{'filename':name,'file_key':'fixture/'+name} for name in uploaded]},
            events=[],received_at='2026-09-10T09:00:00Z')
    elif '/agents/runs/' in path and path.rsplit('/',1)[-1].isdigit():
        n=int(path.rsplit('/',1)[-1])
        data=dict(id=n, agent_id=7, user_id=14, organization_id=66, status='PENDING_REVIEW',
            review_schema={'template_key':'payment_knock_off'},
            source_caption=f'Review fixture {n}', source_channel='WECHAT',
            extracted_data={'currency':'MYR','payment_slips':[], 'requested_invoices':[],'sql_preview':{'status':'ready'}},
            output_refs={}, bundle=None, events=[], received_at='2026-09-10T09:00:00Z')
    elif path.endswith('/agents/7'):
        data={'id':7,'name':'Payment Knock Off','config':{'template_key':'payment_knock_off'},'status':'ACTIVE'}
    elif path.rstrip('/').endswith('/invoices'):
        data={'success':True,'data':{'invoices':[],'total':0,'page':1,'page_size':100}}
    elif path.endswith('/capture/inbox/work-items'):
        query = parse_qs(url.query)
        page = int(query.get('page',['1'])[0])
        rows = [dict(id=f'capture:{n}', capture_event_id=n, stage='TO_REVIEW', status='PENDING_REVIEW',
            status_label='Needs review', source_type='WECHAT', title=f'Payment fixture {n}',
            sender='stable-id', sender_name='Test sender', preview='Waiting for original payment evidence', filenames=[],
            received_at='2026-09-10T09:00:00Z', requires_attention=True, workflow_name='Payment Knock Off',
            workflow_key='payment_knock_off', workflow_label='Payment Knock Off', payment_category='PENDING_SLIP',
            payment_flags=['CUSTOMER_CONFIRMATION_REQUIRED','PENDING_SLIP'],
            funds_status='CONFIRMED_RECEIVED', slip_status='PENDING', invoice_status='MATCHED',
            created_at='2026-09-10T09:00:00Z', updated_at='2026-09-10T09:00:00Z',
            review_url=f'/capture/messages/{n}', result_type='intake_bundle', attachment_count=1)
            for n in range((page-1)*30+1,page*30+1)]
        data = dict(items=rows, total=90, page=page, page_size=30,
            counts=dict(all=90,to_review=90,in_progress=0,completed=0),
            workflow_counts=dict(all=90,payment_knock_off=90,order_to_invoice=0,other=0),
            payment_summary=dict(category_counts={'PENDING_SLIP':90}, flag_counts={}, eligible_cases=90,completed_cases=0,fault_excluded_cases=0,completion_rate=0))
    elif '/capture/inbox/' in path:
        n=int(path.rsplit('/',1)[-1])
        data=dict(id=n,organization_id=66,source_type='WECHAT',external_id=f'fixture-{n}',sender='stable-id',sender_name='Test sender',
            recipients=[],subject='Payment fixture',body_preview='Waiting for evidence',attachments=[],status='ROUTED',
            job_ids=[],created_at='2026-09-10T09:00:00Z',updated_at='2026-09-10T09:00:00Z')
    route.fulfill(status=200,content_type='application/json',body=json.dumps(data))

with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    context=browser.new_context(viewport={'width':1440,'height':900},service_workers='block')
    context.route('**/*',respond)
    context.add_cookies([dict(name='auth_token',value='fixture-only',url=BASE)])
    context.add_init_script("""localStorage.setItem('access_token','fixture-only');
        localStorage.setItem('selected_organization_id','66');
        localStorage.setItem('smartdok.inbox.workstream','payment_knock_off');""")
    page=context.new_page()
    page.on('pageerror',lambda e:(errors.append(str(e)), print('PAGE ERROR',str(e))))
    page.on('console',lambda m: print('CONSOLE',m.text) if m.type=='error' else None)
    page.goto(BASE+'/capture')
    panel=page.get_by_role('region',name='Payment workflow filters')
    expect(panel).to_be_visible(timeout=20000)
    try:
        expect(page.get_by_text('Payment fixture 1',exact=True)).to_be_visible(timeout=10000)
    except Exception:
        print(page.locator('body').inner_text()[-6500:])
        raise
    panel.get_by_role('button',name='2 · pending slip').click()
    panel.get_by_role('checkbox',name='customer confirmation required').check()
    panel.get_by_role('checkbox',name='pending slip',exact=False).check()
    page.get_by_role('button',name='Next',exact=True).click()
    expect(page.get_by_text('Payment fixture 31',exact=True)).to_be_visible()
    assert any('page=2' in r and 'payment_flags=CUSTOMER_CONFIRMATION_REQUIRED%2CPENDING_SLIP' in r for r in requests), requests[-5:]
    link=page.get_by_role('link',name='Open payment context').nth(8)
    link.scroll_into_view_if_needed()
    saved_scroll=page.locator('main').evaluate('(e)=>e.scrollTop')
    assert saved_scroll>500
    link.click()
    page.wait_for_url('**/capture/messages/*')
    expect(page.get_by_text('Correct sender display name',exact=True)).to_be_visible()
    page.get_by_role('link',name='Back to inbox').click()
    expect(page.get_by_text('Payment fixture 31',exact=True)).to_be_attached()
    page.wait_for_function('(y)=>Math.abs(document.querySelector("main").scrollTop-y)<5',arg=saved_scroll)
    expect(panel.get_by_role('checkbox',name='customer confirmation required')).to_be_checked()
    expect(panel.get_by_role('checkbox',name='pending slip',exact=False)).to_be_checked()
    expect(panel.get_by_role('button',name='2 · pending slip')).to_have_attribute('aria-pressed','true')
    assert not errors, errors
    print(json.dumps({'passed':['stacked flags query','page 2 retained','category retained','flags retained','main scroll restored','no page exceptions'], 'scroll':saved_scroll}))
    # Exercise Review's own list and detail route; this was missing from the
    # original navigation test. More than 200 runs proves paginated fetching.
    page.goto(BASE+'/review')
    search=page.get_by_placeholder('Search task, company, workflow, or reason')
    expect(search).to_be_visible(timeout=20000)
    search.fill('Review fixture')
    expect(page.get_by_text('Review fixture 220',exact=True)).to_be_attached(timeout=20000)
    review_link=page.locator('a[href^="/review/"]').filter(has_text='Review task').nth(15)
    review_link.scroll_into_view_if_needed()
    review_scroll=page.locator('main').evaluate('(e)=>e.scrollTop')
    review_link.click()
    page.wait_for_url('**/review/*')
    page.get_by_role('button',name='Back to Review',exact=True).click(timeout=20000)
    expect(search).to_have_value('Review fixture')
    page.wait_for_function('(y)=>Math.abs(document.querySelector("main").scrollTop-y)<5',arg=review_scroll)
    # Browser back/forward must use the same persisted list state.
    page.go_back()
    page.wait_for_url('**/review/*')
    page.go_forward()
    expect(search).to_have_value('Review fixture')
    page.wait_for_function('(y)=>Math.abs(document.querySelector("main").scrollTop-y)<5',arg=review_scroll)
    assert not errors, errors
    print(json.dumps({'passed':['Review loads beyond 200','Review detail return restores search and scroll','browser back/forward restores Review'], 'scroll':review_scroll}))
    page.goto(BASE+'/review/16')
    section=page.locator('section').filter(has=page.get_by_role('heading',name='Add clearer payment evidence',exact=True))
    expect(section).to_be_visible(timeout=20000)
    picker=section.locator('input[type=file]')
    picker.set_input_files([{'name':f'slip-{i}.png','mimeType':'image/png','buffer':b'fixture-image'} for i in range(3)])
    expect(section.get_by_text('3 / 20 selected.',exact=False)).to_be_visible()
    # Exercise actual drop handling, then submit the resulting multipart body.
    drop=section.get_by_role('button',name='Drop images or PDFs here',exact=False)
    transfer=page.evaluate_handle('''() => {const d=new DataTransfer();for(let i=3;i<20;i++) d.items.add(new File(['fixture-image'],`slip-${i}.png`,{type:'image/png'}));return d;}''')
    drop.dispatch_event('drop',{'dataTransfer':transfer})
    expect(section.get_by_text('20 / 20 selected.',exact=False)).to_be_visible()
    picker.set_input_files([{'name':'overflow.png','mimeType':'image/png','buffer':b'fixture-image'}])
    expect(section.get_by_role('alert')).to_contain_text('up to 20 files')
    section.get_by_role('button',name='Upload',exact=False).click()
    page.wait_for_function('()=>!document.body.innerText.includes("20 / 20 selected.")')
    assert len(uploaded)==20 and len(set(uploaded))==20 and 'overflow.png' not in uploaded,uploaded
    assert any('/agents/runs/16/payment-evidence' in r for r in requests)
    assert not errors,errors
    print(json.dumps({'passed':['picker appends files','drop appends to picker selection','20-file cap in UI','20 files posted to original Review'],'uploaded':len(uploaded)}))
    browser.close()
