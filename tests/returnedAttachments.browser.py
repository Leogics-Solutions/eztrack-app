"""Local UI smoke test. All API calls are intercepted; no messages or SQL writes.
Start isolated Next dev on 3196, then run this with Python Playwright.
"""
import json
import re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3196'
run = dict(id=99999, agent_id=7, user_id=14, organization_id=66,
    status='VERIFICATION_PASSED', events=[], source_channel='WHATSAPP',
    source_caption='Local attachment test', received_at='2026-09-30T08:00:00Z',
    extracted_data=dict(customer='Test customer', inv_date='2026-09-30', lines=[],
        issuing_entity=dict(fulfilment_mode='OUTSOURCED', outbound_channel='WHATSAPP', legal_name='Test partner')),
    output_refs=dict(external_documents=[dict(filename='original.pdf', file_key='fixture/original.pdf', kind='INVOICE')],
        supplier_document_verification=dict(status='PASSED', documents=[]),
        notify=dict(group_jid='fixture@g.us', group_name='Test source')))
mutations = []
errors = []

def respond(route):
    url = urlparse(route.request.url)
    if url.netloc == '127.0.0.1:3196' and not url.path.startswith('/api/'):
        return route.continue_()
    path = url.path
    data = dict(success=True, data=[], items=[], total=0, unread_count=0)
    if route.request.method not in ('GET', 'HEAD', 'OPTIONS'):
        mutations.append(path)
        assert '/returned-documents' in path, f'Unexpected mutation: {path}'
        if path.endswith('/remove'):
            body = route.request.post_data_json
            assert body['expected_file_keys'] == [d['file_key'] for d in run['output_refs']['external_documents']]
            run['output_refs']['external_documents'] = [d for d in run['output_refs']['external_documents'] if d['file_key'] != body['file_key']]
        else:
            names = re.findall(r'filename="([^"]+)"', route.request.post_data or '')
            for name in names:
                run['output_refs']['external_documents'].append(dict(filename=name, file_key='fixture/'+name))
        run['status'] = 'EXTERNAL_DOCUMENTS_RECEIVED' if run['output_refs']['external_documents'] else 'WAITING_EXTERNAL_DOCUMENTS'
        run['output_refs'].pop('supplier_document_verification', None)
        data = run
    elif path.endswith(('/auth/me', '/users/me')):
        data = dict(success=True, data=dict(id=14,email='test@example.com',full_name='Test Reviewer',role='business',status='active'))
    elif path.endswith('/users/me/organizations'):
        data = dict(success=True,data=[dict(id=66,name='Local test',is_primary=True)])
    elif path.endswith('/agents/runs/99999'):
        data = run
    route.fulfill(status=200, content_type='application/json', body=json.dumps(data))

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport=dict(width=1440,height=1100),service_workers='block')
    context.route('**/*', respond)
    context.add_cookies([dict(name='auth_token',value='fixture-only',url=BASE)])
    context.add_init_script("localStorage.setItem('access_token','fixture-only'); localStorage.setItem('selected_organization_id','66');")
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto(BASE+'/review/outsourced/99999', timeout=120000)
    post = page.get_by_role('button', name='Post to Test source', exact=True)
    expect(post).to_be_enabled(timeout=60000)
    page.get_by_label('Add returned files', exact=True).set_input_files([
        dict(name='invoice.pdf',mimeType='application/pdf',buffer=b'%PDF-test'),
        dict(name='discard.pdf',mimeType='application/pdf',buffer=b'%PDF-test')])
    expect(page.get_by_text('Selected, not uploaded (2)',exact=True)).to_be_visible()
    page.get_by_label('Remove selected discard.pdf').click()
    page.get_by_role('button',name='Upload 1 file',exact=True).click()
    expect(page.get_by_text('invoice.pdf',exact=True)).to_be_visible()
    expect(post).to_be_disabled()
    page.reload()
    expect(page.get_by_text('invoice.pdf',exact=True)).to_be_visible()
    page.get_by_role('button',name='Remove',exact=True).first.click()
    expect(page.get_by_text('original.pdf',exact=True)).to_have_count(0)
    expect(page.get_by_text('invoice.pdf',exact=True)).to_be_visible()
    expect(post).to_be_disabled()
    Path('test-results').mkdir(exist_ok=True)
    page.get_by_role('heading',name='DO / Invoice returned by Test partner').locator('..').locator('..').screenshot(path='test-results/returned-attachments.png')
    run['status'] = 'COMPLETED'
    page.reload()
    expect(page.get_by_label('Add returned files',exact=True)).to_be_disabled()
    expect(page.get_by_role('button',name='Remove',exact=True)).to_be_disabled()
    assert len(mutations) == 2, mutations
    assert not errors, errors
    browser.close()
print('PASS: multi-selection, deselection, upload, persisted refresh, removal, verification gate, completed lock; no delivery calls.')
