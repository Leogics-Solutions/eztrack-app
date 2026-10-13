"""Retained unresolved-company orders remain reachable with stale filters.

Uses a local production build and mocked APIs only; no provider/SQL writes.
"""
import json
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect

BASE='http://localhost:3169'
writes=[];errors=[];requested_pages=[]
def run(rid,destination='SQL',template='order_to_invoice'):
    return {'id':rid,'agent_id':6,'status':'PENDING_REVIEW','template_key':template,
        'agent_name':'Customer PO to DO & Invoice','approval_destination':destination,
        'source_caption':f'META TO BIKERS - Review {rid}','received_at':'2026-10-13T01:53:41Z'}
first=[run(n) for n in range(2000,2200)]
second=[run(1912,'UNRESOLVED'),run(1913,'UNRESOLVED'),run(1914,'EMAIL'),run(1915,'SQL','payment_knock_off')]

def respond(route):
    u=urlparse(route.request.url)
    if u.netloc=='localhost:3169' and not u.path.startswith('/api/'):
        return route.continue_()
    if route.request.method not in ('GET','OPTIONS'):writes.append(u.path)
    data={'success':True,'data':[],'items':[],'total':0,'unread_count':0,'result':{},'status':'NONE'}
    if u.path.endswith(('/auth/me','/users/me')):
        data={'success':True,'data':{'id':14,'email':'fixture@example.com','role':'business','status':'active'}}
    elif u.path.endswith('/users/me/organizations'):
        data={'success':True,'data':[{'id':66,'name':'Fixture','is_primary':True}]}
    elif u.path.endswith('/agents/runs'):
        page=int(parse_qs(u.query).get('page',['1'])[0]);requested_pages.append(page)
        data={'runs':first if page==1 else second,'total':204}
    elif u.path.endswith('/invoices'):
        data={'success':True,'data':{'invoices':[],'total':0}}
    route.fulfill(status=200,content_type='application/json',body=json.dumps(data))

with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    ctx=browser.new_context(service_workers='block')
    ctx.route('**/*',respond)
    ctx.add_cookies([{'name':'auth_token','value':'fixture-only','url':BASE}])
    ctx.add_init_script("localStorage.setItem('access_token','fixture-only');localStorage.setItem('selected_organization_id','66');")
    page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE+'/review?workflow=order_to_invoice')
    panel=page.get_by_role('region',name='Issuing company needs confirmation')
    expect(panel).to_be_visible()
    expect(panel.get_by_role('link',name='#1912',exact=False)).to_be_visible()
    expect(panel.get_by_role('link')).to_have_count(2)
    assert 2 in requested_pages
    page.get_by_placeholder('Search task, company, workflow, or reason').fill('will-not-match-any-order')
    expect(page.get_by_text('No tasks match these filters',exact=True)).to_be_visible()
    expect(panel.get_by_role('link',name='#1912',exact=False)).to_be_visible()
    assert panel.get_by_role('link',name='#1912',exact=False).get_attribute('href')=='/review/1912#issuing-company'
    page.get_by_role('button',name='Completed (',exact=False).click()
    expect(panel).to_be_visible()
    assert not errors and not writes,(errors,writes)
    page.screenshot(path='C:/Users/PC/Documents/ChatGPT/Maple/output/issuer-fallback-20261013/unresolved-company.png',full_page=True)
    browser.close()
print('PASS: unresolved orders on later API pages stay reachable despite search/status/view filters; outsourced/payment items excluded; zero API writes.')
