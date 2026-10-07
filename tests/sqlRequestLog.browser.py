from pathlib import Path
import subprocess
from playwright.sync_api import sync_playwright, expect

subprocess.run(['node', 'tests/sqlRequestLog.browser.cjs'], check=True)
out = Path('../output/dashboard-sql-log-20261007/browser')
css = '\n'.join(p.read_text(encoding='utf-8') for p in Path('.next/static').rglob('*.css'))
theme = ':root{--foreground:#14212b;--muted-foreground:#536574;--card:#fff;--background:#f3f7f9;--border:#cad5dc}body{font-family:Arial,sans-serif;color:var(--foreground);background:var(--background)}'
errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width':1440,'height':1050}, accept_downloads=True)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/*', lambda route: route.abort())
    page.set_content('<style>'+css+theme+'</style><div id="app"></div>')
    page.add_script_tag(content=(out/'bundle.js').read_text(encoding='utf-8'))
    expect(page.get_by_role('link',name='#1570',exact=True)).to_be_visible()
    expect(page.get_by_text('Maincell Admin 2',exact=True)).to_be_visible()
    expect(page.get_by_text('07/10/2026, 17:00:00',exact=True)).to_be_visible()
    page.screenshot(path=str(out/'dashboard-log.png'),full_page=True)
    page.get_by_role('button',name='Next / 下一页',exact=True).click()
    expect(page.get_by_role('link',name='#1570',exact=True)).to_have_count(0)
    expect(page.get_by_role('button',name='Previous / 上一页',exact=True)).to_be_enabled()
    page.get_by_role('combobox',name='Company / 公司',exact=True).select_option('FLEXERO SDN BHD')
    page.get_by_role('combobox',name='State / 状态',exact=True).select_option('FAILED')
    page.get_by_role('button',name='Filter / 筛选',exact=True).click()
    expect(page.get_by_role('link',name='#1658',exact=True)).to_be_visible()
    expect(page.get_by_role('button',name='Next / 下一页',exact=True)).to_be_disabled()
    with page.expect_download() as info:
        page.get_by_role('button',name='Export CSV / 导出 CSV',exact=True).click()
    download = info.value; download.save_as(out/'filtered.csv')
    assert (out/'filtered.csv').read_bytes().startswith(b'\xef\xbb\xbf')
    calls=page.evaluate('window.fixture.calls')
    assert calls[-1] == {'type':'export','filters':{'company':'FLEXERO SDN BHD','state':'FAILED'}}
    assert calls[-2]['offset'] == 0
    page.screenshot(path=str(out/'filtered-log.png'),full_page=True)
    page.get_by_role('button',name='Reset / 重置',exact=True).click()
    expect(page.get_by_role('link',name='#1570',exact=True)).to_be_visible()
    page.evaluate('window.fixture.org=77;window.renderFixture()')
    expect(page.get_by_role('link',name='#1570',exact=True)).to_have_count(0)
    expect(page.get_by_text('No matching SQL requests',exact=False)).to_be_visible()
    assert not errors, errors
    browser.close()
print('PASS: Dashboard rows, submitter, MYT time, pagination, company/state filter, full filtered CSV, workspace reset; offline only.')
