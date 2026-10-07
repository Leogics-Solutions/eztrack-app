from pathlib import Path
import subprocess
from playwright.sync_api import sync_playwright, expect

subprocess.run(['node','tests/inboxSearch.browser.cjs'],check=True)
out=Path('../output/inbox-search-20261007/browser');errors=[]
css='\n'.join(p.read_text(encoding='utf-8') for p in Path('.next/static').rglob('*.css'))+'body{font-family:Arial,sans-serif}'
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':1400,'height':950})
    page.on('pageerror',lambda error: errors.append(str(error)))
    page.route('**/*',lambda route: route.abort())
    # A real origin supports the existing sessionStorage return-state hook.
    page.route('https://inbox-fixture.test/',lambda route: route.fulfill(body='<div id="app"></div>',content_type='text/html'))
    page.goto('https://inbox-fixture.test/')
    page.add_style_tag(content=css)
    page.add_script_tag(content=(out/'bundle.js').read_text(encoding='utf-8'))
    expect(page.get_by_text('Fixture payment 1553',exact=True)).to_be_visible()
    search=page.get_by_role('textbox',name='Search Inbox')
    page.evaluate('window.fixture.calls=[]')
    search.press_sequentially('1563',delay=40)
    expect(page.get_by_text('Searching Inbox…',exact=True)).to_be_visible()
    expect(page.get_by_text('Fixture payment 1553',exact=True)).to_have_count(0)
    expect(page.get_by_text('Fixture payment 1563',exact=True)).to_be_visible()
    assert page.evaluate('window.fixture.calls.map(c=>c.search)')==['1563']
    page.evaluate('window.fixture.calls=[];window.fixture.delays["1553"]=1200')
    search.fill('1553')
    page.wait_for_function('window.fixture.calls.some(c=>c.search==="1553")')
    search.fill('1554')
    expect(page.get_by_text('Fixture payment 1554',exact=True)).to_be_visible()
    assert page.evaluate('window.fixture.calls.find(c=>c.search==="1553").aborted')
    page.wait_for_timeout(1300)
    expect(page.get_by_text('Fixture payment 1553',exact=True)).to_have_count(0)
    search.fill('')
    expect(page.get_by_text('Fixture payment 1553',exact=True)).to_be_visible()
    page.evaluate('window.fixture.fail=true')
    search.fill('1555')
    expect(page.get_by_text('Fixture network error',exact=True)).to_be_visible()
    expect(page.get_by_text('Search could not complete. Please refresh to try again.',exact=True)).to_be_visible()
    page.evaluate('window.fixture.fail=false')
    page.get_by_role('button',name='Refresh',exact=True).click()
    expect(page.get_by_text('Fixture payment 1555',exact=True)).to_be_visible()
    page.screenshot(path=str(out/'search.png'),full_page=True)
    assert not errors,errors
    browser.close()
print('PASS: rapid typing makes one search; stale cards hidden; previous request aborted; old result cannot overwrite; clear and failure/refresh recovery. Offline only.')
