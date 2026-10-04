"""Serve simulator fixtures over HTTP so WebKit has real session history."""
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import json,time
from datetime import datetime,timezone,timedelta

background_start=None
background_timestamp=None
def background_payload(path):
    global background_start,background_timestamp
    if path=='/__test/background/reset':
        background_start=time.monotonic();background_timestamp=datetime.now(timezone.utc);return {'ok':True}
    fresh=background_start is not None and time.monotonic()-background_start>=35
    stamp=(background_timestamp or datetime.now(timezone.utc))+(timedelta(seconds=35) if fresh else timedelta(days=-1))
    message={'id':'background-new' if fresh else 'background-old','senderId':'fixture-peer','createdAt':stamp.isoformat().replace('+00:00','Z'),'type':'text','text':'后台收到的测试消息' if fresh else '旧消息'}
    if path=='/api/v1/me/counters':return {'unreadMessages':8 if fresh else 0}
    if path=='/api/v1/matches/background-fixture/messages':return {'items':[message]}
    if path=='/api/v1/matches':
        summary={key:value for key,value in message.items() if key not in ['id','text']} if fresh else message
        return {'items':[{'id':'background-fixture','unreadCount':1 if fresh else 0,'user':{'id':'fixture-peer','displayName':'测试联系人'},'lastMessage':summary}]}
    return {'id':'fixture-me'}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        url=urlparse(self.path)
        if url.path.startswith('/api/v1/') or url.path=='/__test/background/reset':
            body=json.dumps(background_payload(url.path),ensure_ascii=False).encode();self.send_response(200);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body);return
        if url.path=='/health':
            body=b'ok'
        elif url.path.startswith('/external/'):
            name='A' if url.path.endswith('/a') else 'B'
            body=(f'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>External {name}</title><style>body{{font:18px system-ui;padding:16px}}a{{display:inline-block;min-height:44px;padding:14px 18px;background:#eee;border-radius:12px}}</style></head><body><h1>External {name}</h1><a href="/external/b">Next page</a></body></html>').encode()
        else:
            fixture='layout-fixture.html' if parse_qs(url.query).get('fixture')==['layout'] else 'navigation-fixture.html'
            if parse_qs(url.query).get('fixture')==['gestures']:fixture='gesture-fixture.html'
            if parse_qs(url.query).get('fixture')==['continuity']:fixture='continuity-native-fixture.html'
            if parse_qs(url.query).get('fixture')==['surfaces'] or url.path in ['/me','/profile/edit/basics','/profile/edit/about','/profile/edit/photos']:fixture='surface-fixture.html'
            if parse_qs(url.query).get('fixture')==['preferences']:fixture='preference-fixture.html'
            body=Path(__file__).with_name(fixture).read_bytes()
        self.send_response(200)
        self.send_header('Content-Type','text/html; charset=utf-8')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers()
        self.wfile.write(body)

HTTPServer(('127.0.0.1',18765),Handler).serve_forever()
