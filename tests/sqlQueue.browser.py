"""Run after npm build; browser component tests entirely offline."""
from pathlib import Path
import subprocess
from playwright.sync_api import sync_playwright, expect

subprocess.run(['node', 'tests/sqlQueue.browser.cjs'], check=True)
out = Path('../output/sql-dispatch-20261003/browser')
css = '\n'.join(p.read_text(encoding='utf8') for p in Path('.next-sql-dispatch-check/static').rglob('*.css'))
errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width':1440,'height':1000})
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('**/*', lambda route: route.abort())
    page.set_content('<style>'+css+'</style><div id="app"></div>')
    page.add_script_tag(content=(out/'bundle.js').read_text(encoding='utf8'))
    expect(page.get_by_text('Scheduled for the SQL batch', exact=False)).to_be_visible()
    expect(page.get_by_text('Create OR & knock off', exact=True)).to_be_visible()
    page.get_by_role('button', name='2. Post all 2 sets to SQL', exact=True).click()
    select = page.get_by_role('combobox', name='SQL processing time')
    expect(select).to_be_visible()
    expect(select).to_have_value('BATCH')
    select.select_option('IMMEDIATE')
    page.get_by_role('button', name='Approve all prepared sets', exact=True).click()
    expect(page.get_by_text('SQL queue position: 2.', exact=False)).to_be_visible()
    assert page.evaluate('window.fixture.calls') == [[9002,'APPROVE',False,None,'IMMEDIATE']]
    expect(page.get_by_role('button',name='2. Post all 2 sets to SQL', exact=True)).to_be_disabled()
    page.screenshot(path=str(out/'scheduled-and-urgent.png'))
    # Polling picks up admission into the shared queue, then a stopped unknown OR.
    page.evaluate("window.fixture.payment={id:'payment-job',status:'PENDING',queue_position:3,result:{stage:'QUEUED'}}")
    expect(page.get_by_text('SQL queue position: 3.', exact=False)).to_be_visible(timeout=5000)
    page.evaluate("window.fixture.payment={id:'payment-job',status:'INTERRUPTED',result:{stage:'RECONCILE_REQUIRED',detail:'Check the saved SQL result before retrying; no automatic replay.'}}")
    expect(page.get_by_text('Payment needs attention', exact=False)).to_be_visible(timeout=5000)
    expect(page.get_by_text('Check the saved SQL result', exact=False)).to_be_visible()
    page.screenshot(path=str(out/'interrupted-or.png'))
    assert page.evaluate('window.fixture.finished') == 1
    assert not errors, errors
    browser.close()
print('PASS: batch schedule, urgent submission, mixed queue status, disabled duplicate submission, interrupted OR; no server or live API.')
