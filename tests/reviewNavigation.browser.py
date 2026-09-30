"""Review navigation regression; all APIs mocked, no SQL writes or messages."""
import json
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

BASE = 'http://localhost:3149'
projects = {1353: ('NOORDINZ PENANG', 8400), 1358: ('PRINTING', 2750)}
held, writes, errors = [], [], []
delay = {'id': None}

def fixture(i):
    name, amount = projects[i]
    return dict(id=i, status='PENDING_REVIEW', agent_id=7, organization_id=66,
        review_schema={'template_key': 'order_to_invoice'}, output_refs={}, events=[],
        source_caption='Navigation test', bundle={'index': 12 if i == 1353 else 17,
        'total': 17, 'pending_count': 2, 'members': [{'id': n, 'ready': False} for n in projects]},
        extracted_data={'currency': 'MYR', 'no_conversion': True, 'customer': 'TEST',
        'customer_code': 'C1', 'inv_date': '2026-09-29', 'main_description': name,
        'lines': [{'name': name, 'more_description': name, 'qty': 1, 'unit': '',
        'unit_price_foreign': amount, 'amount_foreign': amount,
        'unit_price_myr': amount, 'amount_myr': amount, 'match': {'en_description': name}}],
        'totals': {'grand_total_myr': amount, 'amount_foreign_total': amount}})

def respond(route):
    u = urlparse(route.request.url)
    if u.netloc == 'localhost:3149' and not u.path.startswith('/api/'):
        return route.continue_()
    data = {'success': True, 'data': [], 'items': [], 'total': 0, 'unread_count': 0, 'result': {}, 'status': 'NONE'}
    if u.path.endswith(('/auth/me', '/users/me')):
        data = {'success': True, 'data': {'id': 14, 'email': 'fixture@example.com', 'role': 'business', 'status': 'active'}}
    elif u.path.endswith('/users/me/organizations'):
        data = {'success': True, 'data': [{'id': 66, 'name': 'Test', 'is_primary': True}]}
    for i in projects:
        if u.path.endswith(f'/agents/runs/{i}'):
            if delay['id'] == i:
                held.append(route)
                return
            data = fixture(i)
    if route.request.method not in {'GET', 'OPTIONS'}:
        writes.append(u.path)
    route.fulfill(status=200, content_type='application/json', body=json.dumps(data))

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    ctx = browser.new_context(service_workers='block')
    ctx.route('**/*', respond)
    ctx.add_cookies([dict(name='auth_token', value='fixture-only', url=BASE)])
    ctx.add_init_script("localStorage.setItem('access_token','fixture-only');localStorage.setItem('selected_organization_id','66');")
    page = ctx.new_page()
    page.on('console', lambda m: print(m.text, flush=True) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))
    for prefix in ['/review/', '/agents/runs/']:
        page.goto(BASE + prefix + '1353')
        expect(page.get_by_role('cell', name='NOORDINZ PENANG', exact=True).first).to_be_visible()
        delay['id'] = 1358
        page.evaluate("path => { void window.next.router.push(path); }", prefix + '1358')
        expect(page.get_by_role('cell', name='NOORDINZ PENANG', exact=True)).to_have_count(0)
        expect(page.get_by_role('button', name='Save corrections', exact=True)).to_have_count(0)
        page.evaluate("path => { void window.next.router.push(path); }", prefix + '1353')
        expect(page.get_by_role('cell', name='NOORDINZ PENANG', exact=True).first).to_be_visible()
        delay['id'] = None
        for route in held:
            route.fulfill(status=200, content_type='application/json', body=json.dumps(fixture(1358)))
        held.clear()
        page.wait_for_timeout(250)
        expect(page.get_by_role('cell', name='NOORDINZ PENANG', exact=True).first).to_be_visible()
        page.evaluate("path => { void window.next.router.push(path); }", prefix + '1358')
        expect(page.get_by_role('cell', name='PRINTING', exact=True).first).to_be_visible()
        expect(page.get_by_role('cell', name='NOORDINZ PENANG', exact=True)).to_have_count(0)
        expect(page.get_by_text('Set 17 of 17 from the same source')).to_be_visible()
        assert page.locator('input[value="2750"]').count() >= 1
    assert not errors and not writes, (errors, writes)
    browser.close()
    print('PASS: both routes clear old forms, disable stale saves, ignore delayed old responses, and load correct project/amount/set.')
