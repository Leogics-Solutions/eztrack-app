"""No live HTTP, SQL or customer messages; test the rendered real component."""
from pathlib import Path
import json
import subprocess
from playwright.sync_api import sync_playwright, expect

subprocess.run(['node', 'tests/paymentAuto.browser.cjs'], check=True)
out = Path('../output/kenzee-payment-automation-20261003/browser')
css = '\n'.join(p.read_text(encoding='utf8') for p in Path('.next-kenzee-payment-check/static').rglob('*.css'))
errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1120})
    page.route('**/*', lambda route: route.abort())
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.set_content('<style>'+css+'</style><div id="app"></div>')
    page.add_script_tag(content=(out/'bundle.js').read_text(encoding='utf8'))
    expect(page.get_by_role('heading', name='Automatic knock-off')).to_contain_text('Preview only')
    expect(page.get_by_text('Responsible /', exact=False)).to_contain_text('CS / source PIC')
    expect(page.get_by_text('Next /', exact=False)).to_contain_text('recheck automatically')
    expect(page.get_by_role('textbox', name='Historical waiting Review IDs')).to_have_value('1360, 1418')
    expect(page.get_by_test_id('foreign-balance')).to_contain_text('USD 100.00')
    expect(page.get_by_test_id('foreign-balance')).to_contain_text('MYR 450.00')
    page.screenshot(path=str(out/'waiting-slip-policy.png'), full_page=True)
    page.get_by_role('textbox', name='Historical waiting Review IDs').fill('0, invalid')
    page.get_by_role('button', name='Save & preview without posting').click()
    expect(page.get_by_role('alert')).to_contain_text('positive Review IDs')
    assert page.evaluate('window.fixture.calls') == []
    page.get_by_role('textbox', name='Historical waiting Review IDs').fill('1360, 1418')
    page.get_by_role('button', name='Save & preview without posting').click()
    expect(page.get_by_role('alert')).to_have_count(0)
    calls = page.evaluate('window.fixture.calls')
    assert calls[0][1] == 'PREVIEW' and calls[0][2]['include_run_ids'] == [1360, 1418]
    assert calls[0][2]['rules']['customer_rules'] == [{'connection_id':7,'customer_code':'300-A0005','oldest_open_first':True,'default_payment_method':'BANK1'}]
    # Navigate without remounting: previous customer/history must not leak.
    page.evaluate('window.fixture.runId=1418;window.renderFixture()')
    expect(page.get_by_role('textbox', name='Historical waiting Review IDs')).to_have_value('')
    expect(page.get_by_role('combobox', name='Default receiving bank')).to_have_value('')
    expect(page.get_by_text('Responsible /', exact=False)).to_contain_text('Finance')
    expect(page.get_by_text('Evidence /', exact=False)).to_contain_text('Review #1418')
    expect(page.get_by_text('Evidence /', exact=False)).to_contain_text('300-N0001')
    expect(page.get_by_text('Next /', exact=False)).to_contain_text('actual bank receipt date')
    expect(page.get_by_text('Waiting for slip', exact=False)).to_have_count(0)
    page.screenshot(path=str(out/'waiting-finance-policy.png'), full_page=True)
    assert not errors, errors
    browser.close()
(out/'verification.json').write_text(json.dumps({'offline':True,'browser_errors':errors,'scoped_defaults':True,
    'historical_scope_validation':True,'cross_review_navigation_isolated':True,'preview_save_verified':True,
    'foreign_invoice_and_myr_balance_visible':True}),encoding='utf8')
print('PASS: rendered waiting status, evidence/owner/next action, scoped defaults, preview save, invalid IDs, cross-review navigation; no live API.')
