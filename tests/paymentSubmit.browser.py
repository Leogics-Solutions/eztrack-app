"""Browser acceptance on a candidate build. All APIs intercepted; no SQL or sends."""
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

BASE = 'http://localhost:3148'
state = {'submitted': 0, 'stage': 'VALIDATING', 'status': 'RUNNING'}
errors = []
run = dict(id=9001, agent_id=7, user_id=14, organization_id=66, status='PENDING_REVIEW',
    review_schema={'template_key':'payment_knock_off'}, source_channel='wechat_group',
    received_at='2026-09-29T09:00:00', updated_at='2026-09-29T09:00:00',
    source_caption='Browser test fixture only', output_refs={}, events=[],
    extracted_data={'currency':'MYR', 'customer':'TEST CUSTOMER', 'customer_code':'C1',
        'sql_preview':{'status':'ready'}, 'payment_slips':[{'amount':100,'payment_date':'2026-09-29',
        'bank_reference':'REF1', 'payment_method_code':'BANK1', 'receipt_status':'CONFIRMED_RECEIVED'}],
        'requested_invoices':[{'invoice_number':'IV1','requested_amount':100,'open_balance':100}],
        'allocations':[{'or_index':1,'invoice_number':'IV1','amount_to_allocate':100}]})

def respond(route):
    url = urlparse(route.request.url)
    if url.netloc == 'localhost:3148' and not url.path.startswith('/api/'):
        return route.continue_()
    path = url.path
    data = {'success':True,'data':[],'items':[],'total':0,'unread_count':0}
    if path.endswith(('/auth/me','/users/me')):
        data={'success':True,'data':{'id':14,'email':'fixture@example.com','full_name':'Reviewer','role':'business','status':'active'}}
    elif path.endswith('/users/me/organizations'):
        data={'success':True,'data':[{'id':66,'name':'Test organization','is_primary':True}]}
    elif path.endswith('/agents/runs/9001/payment-submit'):
        if route.request.method == 'POST':
            state['submitted'] += 1
            run['output_refs']={'payment_submit_active':'job1','payment_submit_job_id':'job1'}
            data=run
        else:
            data={'id':'job1','status':state['status'],'created_at':datetime.now(timezone.utc).isoformat(),
                'result':{'stage':state['stage'],'detail':'Checking payment details and SQL balances.'}}
    elif path.endswith('/agents/runs/9001'): data=run
    elif path.endswith('/agents/7'): data={'id':7,'name':'Payments','config':{'template_key':'payment_knock_off'}}
    elif route.request.method not in {'GET','OPTIONS'}:
        errors.append('Unexpected mutation: '+path)
    route.fulfill(status=200,content_type='application/json',body=json.dumps(data))

with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    ctx=browser.new_context(viewport={'width':1440,'height':1000},service_workers='block')
    ctx.route('**/*',respond)
    ctx.add_cookies([dict(name='auth_token',value='fixture-only',url=BASE)])
    ctx.add_init_script("localStorage.setItem('access_token','fixture-only'); localStorage.setItem('selected_organization_id','66');")
    page=ctx.new_page()
    page.on('pageerror',lambda error: errors.append(str(error)))
    page.goto(BASE+'/review/9001')
    button=page.get_by_role('button',name='Confirm & knock off',exact=True)
    expect(button).to_be_visible(timeout=20000)
    button.click()
    expect(page.get_by_text('Payment processing in the background',exact=False)).to_be_visible()
    expect(button).to_be_disabled()
    assert state['submitted']==1
    page.reload()
    expect(page.get_by_text('Payment processing in the background',exact=False)).to_be_visible(timeout=20000)
    expect(page.get_by_role('button',name='Confirm & knock off',exact=True)).to_be_disabled()
    assert state['submitted']==1
    Path('../output/payment-oneclick').mkdir(exist_ok=True)
    page.get_by_text('Payment processing in the background',exact=False).scroll_into_view_if_needed()
    page.screenshot(path='../output/payment-oneclick/progress-browser.png')
    state['status']='NEEDS_ATTENTION';state['stage']='NOTIFYING'
    run['status']='DELIVERY_PENDING';run['output_refs'].pop('payment_submit_active')
    run['output_refs']['sql_account_payment']={'status':'created','receipts':[{'receipt':{'or_no':'OR1'}}]}
    expect(page.get_by_text('Payment needs attention',exact=False)).to_be_visible(timeout=10000)
    expect(page.get_by_role('button',name='Retry confirmation only')).to_be_enabled(timeout=10000)
    assert state['submitted']==1 and not errors, errors
    print('PASS: one-click queue, disabled duplicate submit, reload resumes progress, delivery-only recovery; no live APIs.')
    browser.close()
