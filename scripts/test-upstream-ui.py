"""Run the actual public frontend with app injections and a fully mocked API.

All writes, account data and sockets are local fixtures. No user/session is used.
Run fetch-upstream-ui.py first, or set UPSTREAM_DIR to an offline snapshot.
"""
from copy import deepcopy
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import json, os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SNAP = Path(os.environ.get('UPSTREAM_DIR', ROOT / 'build/upstream'))
config = json.loads((SNAP / 'config.json').read_text())
me = {'id': 'self', 'displayName': '验证账号', 'status': 'active', 'role': 'none',
      'locale': 'zh-Hant', 'avatar': None, 'vrcVerified': False,
      'onboarding': {'canSwipe': True, 'missing': []},
      'features': {k: {'enabled': True} for k in ['secret_like', 'cancel_like', 'who_liked_me']},
      'browse': {'mode': 'all', 'sorts': ['hot', 'recommended', 'active', 'new']},
      'energy': {'permanent': 100, 'regen': 100, 'regenMax': 200, 'nextRegenAt': None, 'costs': {'like': 1, 'superlike': 5, 'pass': 0}},
      'settings': {'notify': {'visitorBadge': True}, 'content': {}, 'theme': 'auto', 'colorScheme': 'auto'},
      'featureLimits': [], 'membership': None, 'tier': {'name': '测试', 'id': 'member', 'energyCap': 200}}
card = {'id': 'peer', 'displayName': '验证名片', 'tagline': '验证简介', 'avatar': None,
        'cover': None, 'photos': [], 'badges': {'role': 'none', 'vrcVerified': False},
        'likes': {'likes': 10, 'superlikes': 2}, 'completeness': 1, 'intents': ['friends'],
        'languages': [{'code': 'zh-Hant', 'level': 'native'}], 'platforms': ['desktop'],
        'speech': [], 'models': [], 'status': 'active', 'paused': False, 'nsfw': False,
        'reactions': [], 'guestbook': {'open': False, 'count': 0},
        'relation': {'blocked': False, 'swiped': 'none', 'secret': False, 'matchState': 'none'},
        'identity': {}, 'preferences': {}, 'stats': {}, 'bio': '验证简介', 'links': [],
        'adult': None, 'statusLights': None, 'vrc': {'platforms': ['desktop'], 'avatarStyles': [],
        'fullBodyTracking': False, 'speech': [], 'voiceRatio': None}, 'commonIntents': [],
        'timezone': 'UTC', 'utcOffsetMin': 0, 'tonight': None, 'questions': [], 'tags': [],
        'traits': [], 'questionsChosen': [], 'coreTags': [], 'interests': [], 'strengths': [],
        'gender': {'modelPresentation': [], 'voice': None, 'identity': '', 'pronouns': ''},
        'dealbreakers': {'tags': [], 'note': ''}, 'favoriteWorlds': [], 'answers': [], 'socialLinks': []}

def person(id, name):
    value = deepcopy(card)
    value.update(id=id, displayName=name)
    return value

SCRIPTS = ['page-surfaces', 'interaction', 'keyboard', 'page-templates', 'app-experience',
           'site-cache', 'notifications', 'content-experience', 'app-theme',
           'chinese-converter', 'app-language', 'chat-pins', 'notification-read']
bridge = '''class MockWebSocket extends EventTarget{static OPEN=1;readyState=0;close(){this.readyState=3}send(){}};
window.WebSocket=MockWebSocket;window.nativeMessages=[];
window.webkit={messageHandlers:{erpNativeApp:{postMessage:m=>nativeMessages.push(m)},erpNativeNotifications:{postMessage:m=>nativeMessages.push(m)}}};
localStorage.setItem('erp_locale','zh-Hant');'''
injections = bridge + '\n' + '\n'.join((ROOT / 'ERPStable' / (name + '.js')).read_text() for name in SCRIPTS)
results = []

class App:
    def __init__(self, browser, path='/discover', locked=False, legacy=False, groups=False):
        self.requests, self.errors = [], []
        self.me = deepcopy(me)
        self.me['features']['secret_like']['enabled'] = not locked
        self.feed = [person('peer' + str(i), '验证名片' + str(i)) for i in range(8)]
        self.secret = [{'user': person('secret-peer', '悄悄名片'), 'action': 'like', 'createdAt': '2026-10-05T12:00:00Z'}]
        self.matches = [{'id': 'thread' + str(i), 'user': person('chat-peer' + str(i), '好友' + str(i)),
                         'pinned': False, 'groupId': None, 'state': 'active', 'unreadCount': 0,
                         'matchedAt': '2026-10-05T12:00:00Z', 'lastMessage': None} for i in range(2)]
        self.rank = [person('rank-low', '官方第一'), person('rank-high', '官方第二')]
        self.rank[0]['likes'] = {'likes': 1, 'superlikes': 0}
        self.rank[1]['likes'] = {'likes': 999, 'superlikes': 10}
        self.page = browser.new_page(viewport={'width': 393, 'height': 793}, is_mobile=True, has_touch=True)
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        init = injections
        if legacy: init += "\nlocalStorage.setItem('vrcrp.chatPins.v1.self',JSON.stringify(['thread1']));"
        if groups: init += "\nlocalStorage.setItem('erp_prefs',JSON.stringify({state:{chatView:'groups',chatOpenGroups:['default'],chatGroup:'default'},version:1}));"
        self.page.add_init_script(init)
        self.page.route('https://erp.sex/**', self.handle)
        self.page.goto('https://erp.sex' + path)
        self.page.wait_for_function("__vrcrpPaintState?.().ready===true && __vrcrpSiteCache?.account()==='self'")
        self.page.wait_for_timeout(350)

    def handle(self, route):
        request = route.request
        url = urlparse(request.url)
        path, query = url.path, parse_qs(url.query)
        if path.startswith('/assets/'):
            file = SNAP / Path(path).name
            if file.exists():
                route.fulfill(body=file.read_bytes(), content_type='text/javascript' if file.suffix == '.js' else 'text/css')
                return
        if path.startswith('/api/v1/'):
            body = request.post_data_json if request.post_data else None
            self.requests.append({'path': path, 'method': request.method, 'query': query, 'body': body})
            value = {'items': [], 'nextCursor': None}
            if path == '/api/v1/me': value = self.me
            elif path == '/api/v1/config': value = config
            elif path == '/api/v1/me/profile': value = person('self', '验证账号')
            elif path == '/api/v1/feed': value = {'items': self.feed, 'exhausted': True}
            elif path == '/api/v1/browse': value = {'items': self.rank, 'nextCursor': None}
            elif path.startswith('/api/v1/profiles/'): value = person(path.rsplit('/', 1)[-1], '验证名片')
            elif path.endswith('/counters'): value = {'unreadMessages': 0, 'newLikes': 0, 'newVisitors': 0, 'unreadNotifications': 0}
            elif path == '/api/v1/match-groups': value = {'groups': [{'id': 'friends', 'name': '朋友', 'count': 0}], 'defaultCount': 2, 'unmatchedCount': 0}
            elif path == '/api/v1/matches':
                items = self.matches
                if query.get('state') == ['unmatched']: items = []
                if query.get('group') == ['friends']: items = []
                if query.get('q'): items = [m for m in items if query['q'][0] in m['user']['displayName']]
                value = {'items': sorted(items, key=lambda m: not m['pinned']), 'nextCursor': None}
            elif path == '/api/v1/likes/secret': value = {'items': self.secret, 'nextCursor': None}
            elif path == '/api/v1/swipe-banner': value = {'items': []}
            if request.method != 'GET':
                value = {'energy': self.me['energy'], 'matched': False}
                if path == '/api/v1/swipes':
                    self.feed = [c for c in self.feed if c['id'] != body['targetId']]
                elif path.endswith('/pin'):
                    next(m for m in self.matches if m['id'] == path.split('/')[-2])['pinned'] = body['pinned']
                elif path.startswith('/api/v1/likes/sent/') and request.method == 'DELETE':
                    self.secret = [x for x in self.secret if x['user']['id'] != path.rsplit('/', 1)[-1]]
            route.fulfill(json=value)
            return
        if path.startswith(('/discover', '/browse', '/likes', '/matches', '/u/', '/visitors', '/settings')):
            route.fulfill(body=(SNAP / 'index.html').read_text(), content_type='text/html')
            return
        route.fulfill(status=404, body='')

    def writes(self, path='/api/v1/swipes'):
        return [r for r in self.requests if r['path'] == path and r['method'] != 'GET']

    def close(self):
        assert not self.errors, self.errors
        self.page.close()

def press(page, button, ms, cancel=None):
    target = button.element_handle()
    target.dispatch_event('pointerdown', {'button': 0, 'pointerId': 1, 'pointerType': 'touch', 'isPrimary': True})
    page.wait_for_timeout(ms)
    target.dispatch_event(cancel or 'pointerup', {'button': 0, 'pointerId': 1, 'pointerType': 'touch', 'isPrimary': True})
    if not cancel: target.dispatch_event('click', {'button': 0})
    page.wait_for_timeout(550)

with sync_playwright() as p:
    for engine in ['chromium', 'webkit']:
        options = {'executable_path': os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), 'args': ['--no-sandbox']} if engine == 'chromium' else {}
        browser = getattr(p, engine).launch(**options)
        app = App(browser)
        page = app.page
        like, superlike = page.locator('#main button.act-like'), page.locator('#main button.act-super')
        assert like.evaluate('e=>__vrcrpOwnsPointerPress(e) && getComputedStyle(e).touchAction==="none" && !e.hasAttribute("data-vrcrp-passive-touch")')
        press(page, like, 50)
        assert len(app.writes()) == 1 and not app.writes()[0]['body'].get('secret'), app.writes()
        press(page, like, 420)
        assert len(app.writes()) == 1, 'Early release must rewind without sending'
        press(page, like, 280, 'pointercancel')
        assert len(app.writes()) == 1, 'Cancelled touch sent a swipe'
        press(page, like, 280, 'pointerleave')
        assert len(app.writes()) == 1, 'Pointer leaving the button sent a swipe'
        press(page, like, 1100)
        assert len(app.writes()) == 2 and app.writes()[-1]['body']['secret'] is True, app.writes()
        press(page, superlike, 1100)
        assert len(app.writes()) == 3 and app.writes()[-1]['body']['action'] == 'superlike' and app.writes()[-1]['body']['secret'] is True
        assert page.locator('[role="dialog"]').count() == 0, 'Secret superlike unexpectedly opened public-note dialog'
        # Progress rings are excluded from native return gestures; all controls
        # and the new hint fit above the original/native bottom bar.
        for width, height in [(320, 793), (375, 793), (393, 793), (393, 700)]:
            page.set_viewport_size({'width': width, 'height': height})
            page.wait_for_function('''height=>{
              const g=document.querySelector('#main .stage').parentElement,n=document.querySelector('.app-bottom');
              return Math.abs(innerHeight-height)<1&&g.getBoundingClientRect().bottom<=n.getBoundingClientRect().top-10;
            }''', arg=height, timeout=3000)
            fit = page.evaluate('''()=>{const a=document.querySelector('#main .act-pass').parentElement,
              g=document.querySelector('#main .stage').parentElement,n=document.querySelector('.app-bottom');
              return {bottom:g.getBoundingClientRect().bottom,nav:n.getBoundingClientRect().top,
                buttons:[...a.querySelectorAll('button')].map(e=>e.offsetWidth),
                touchZones:nativeMessages.filter(m=>m.kind==='gestureZones').at(-1)};}''')
            assert fit['bottom'] <= fit['nav'] - 10, (engine, width, height, fit)
            assert fit['buttons'] == [44, 64, 56, 64], fit
        # An idle, wrapped hint must not cause an app-wide update loop. A
        # delayed innerHeight also must not push actions under the actual bar.
        page.evaluate("window.rootStyleWrites=0;window.rootStyleObserver=new MutationObserver(r=>rootStyleWrites+=r.length);rootStyleObserver.observe(document.documentElement,{attributes:true,attributeFilter:['style']})")
        page.wait_for_timeout(500)
        assert page.evaluate("rootStyleWrites") < 4, 'Idle hint layout repeatedly recomputed the app'
        page.evaluate("rootStyleObserver.disconnect()")
        page.evaluate("window.fixtureHeightDescriptor=Object.getOwnPropertyDescriptor(window,'innerHeight');Object.defineProperty(window,'innerHeight',{get:()=>793,configurable:true});window.dispatchEvent(new Event('resize'))")
        page.evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))")
        page.wait_for_function("document.querySelector('#main .stage').parentElement.getBoundingClientRect().bottom<=document.querySelector('.app-bottom').getBoundingClientRect().top-10")
        page.evaluate("Object.defineProperty(window,'innerHeight',fixtureHeightDescriptor);delete window.fixtureHeightDescriptor")
        page.evaluate("__vrcrpTheme.select('mono')")
        assert page.evaluate("['secret','secret-fg','secret-soft'].every(k=>new Set(getComputedStyle(document.documentElement).getPropertyValue('--'+k).trim().split(/\\s+/)).size===1)")
        page.set_viewport_size({'width': 393, 'height': 793})
        page.locator('#main .stage').get_by_role('button', name='查看名片').filter(visible=True).first.click()
        page.wait_for_timeout(700)
        assert not app.errors, app.errors
        assert page.locator('[data-vrcrp-profile-overlay]').count() == 1
        app.close()
        profile = App(browser, '/browse?sort=recommended')
        page = profile.page
        page.get_by_text('官方第一', exact=True).filter(visible=True).first.click()
        page.wait_for_selector('[role="dialog"] button.touch-none', state='attached')
        profile_like = page.locator('[role="dialog"] button.touch-none').first
        profile_like.scroll_into_view_if_needed()
        assert profile_like.evaluate('e=>__vrcrpOwnsPointerPress(e) && !e.hasAttribute("data-vrcrp-passive-touch")')
        press(page, profile_like, 300)
        assert not profile.writes() and page.locator('[role="dialog"]').count() > 0, 'Profile hold rewinding dismissed sheet or sent swipe'
        press(page, profile_like, 1100)
        assert len(profile.writes()) == 1 and profile.writes()[-1]['body']['secret'] is True and profile.writes()[-1]['body']['source'] == 'profile'
        profile.close()
        locked = App(browser, locked=True)
        press(locked.page, locked.page.locator('#main button.act-like'), 1150)
        assert not locked.writes(), 'App bypassed the official secret-like feature gate'
        assert locked.page.locator('[role="dialog"]').count() > 0, 'Official locked-feature dialog missing'
        locked.close()
        secret = App(browser, '/likes/secret')
        page = secret.page
        links = page.locator('#main nav a')
        assert links.count() == 4 and page.locator('#main nav a[aria-current="page"]').get_attribute('href') == '/likes/secret'
        route = page.evaluate("nativeMessages.filter(m=>m.kind==='route').at(-1)")
        assert route['showTabs'] and not route['canGoBack'], route
        page.locator('#main').get_by_role('button', name='取消喜歡', exact=True).click()
        page.locator('[role="dialog"]').get_by_role('button', name='取消喜歡', exact=True).click()
        page.wait_for_function("!document.querySelector('#main')?.textContent.includes('悄悄名片')")
        assert len(secret.writes('/api/v1/likes/sent/secret-peer')) == 1 and not secret.secret
        page.locator('#main nav a[href="/likes/sent"]').click()
        page.wait_for_url('**/likes/sent')
        page.wait_for_timeout(350)
        assert page.evaluate("nativeMessages.filter(m=>m.kind==='route').at(-1).direction") == 'tab'
        secret.close()
        chat = App(browser, '/matches', legacy=True)
        page = chat.page
        page.wait_for_function("__vrcrpSiteCache.chatMatch('thread1')?.pinned===true")
        assert len(chat.writes('/api/v1/matches/thread1/pin')) == 1
        assert page.evaluate("JSON.parse(localStorage.getItem('vrcrp.chatPins.v1.self')).length") == 0
        rows = page.locator('#main li>a[href^="/matches/"]')
        assert rows.first.get_attribute('href') == '/matches/thread1', 'Official pin order overridden'
        press(page, rows.first, 570)
        assert page.locator('[role="menu"]').is_visible() and not page.locator('#vrcrp-pin-menu').count()
        assert page.url.endswith('/matches'), 'Long press also navigated into chat'
        page.get_by_role('menuitem', name='取消置頂').click()
        page.wait_for_function("__vrcrpSiteCache.chatMatch('thread1')?.pinned===false")
        page.locator('#main input').fill('好友1')
        page.wait_for_timeout(700)
        assert rows.count() == 1 and rows.first.get_attribute('href') == '/matches/thread1'
        chat.close()
        groups = App(browser, '/matches', groups=True)
        assert groups.page.locator('#main section.card').count() == 3
        assert groups.page.locator('#main li>a[href^="/matches/"]').count() == 2
        assert any(r['query'].get('group') == ['default'] for r in groups.requests if r['path'] == '/api/v1/matches')
        groups.close()
        ranking = App(browser, '/browse?sort=hot')
        texts = ranking.page.locator('#main').inner_text()
        assert texts.index('官方第一') < texts.index('官方第二'), 'Client re-sorted official algorithm order by raw counts'
        ranking.page.get_by_text('官方第一', exact=True).filter(visible=True).first.click()
        ranking.page.wait_for_selector('[role="dialog"]')
        assert ranking.page.locator('[role="dialog"] button.touch-none').count() == 0, 'App bypassed hot-ranking read-only profile'
        ranking.close()
        browser.close()
        results.append({'engine': engine, 'officialFrontend': True, 'tapAndHold': True,
                        'cancelAndLeave': True, 'profileHoldAndSheetOwnership': True, 'featureGate': True, 'secretTabNavigation': True, 'secretCancellation': True,
                        'smallScreenControls': True, 'monoSecretTokens': True,
                        'serverPinMigrationAndMenu': True, 'searchAndGroups': True, 'officialRankingOrder': True})
        print('PASS', engine, 'official frontend: hold/cancel/gates, secret navigation, mobile layout, Mono, server pins/search/groups and ranking order')
(ROOT / 'build').mkdir(exist_ok=True)
(ROOT / 'build/upstream-ui-verification.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
