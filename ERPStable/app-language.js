(() => {
  'use strict';
  if (window !== window.top || location.origin !== 'https://erp.sex') return;
  const key = 'vrcrp.language.v1', originals = new Map();
  let i18n = null, loading = false, applying = false, queued = false;
  let choice = 'site';
  try { choice = localStorage.getItem(key) || (/^zh-(?:CN|SG|Hans)/i.test(navigator.language) ? 'zh-Hans' : 'site'); } catch {}
  const simplified = () => choice === 'zh-Hans';
  const copy = value => JSON.parse(JSON.stringify(value));
  function transform(value, ns, path = '') {
    if (ns === 'chat' && path === 'localNote') return '';
    if (typeof value === 'string') return simplified() ? window.__vrcrpToSimplified(value) : value;
    if (Array.isArray(value)) return value.map(v => transform(v, ns, path));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,transform(v,ns,path ? path+'.'+k : k)]));
    return value;
  }
  function capture(ns, value) {
    if (value && typeof value === 'object') originals.set(ns, copy(value));
    return transform(value, ns);
  }
  function repaint() {
    if (!i18n || applying) return;
    applying = true;
    try {
      for (const [ns, value] of originals) i18n.addResourceBundle('zh-Hant', ns, transform(value, ns), true, true);
      // Translate resources, never DOM text: names, posts and messages stay intact.
      i18n.emit('languageChanged', i18n.language);
      window.__vrcrpPageTemplates?.clear();
      window.__vrcrpClearNavigation?.();
      try { window.webkit?.messageHandlers?.erpNativeApp?.postMessage({kind:'languageChanged'}); } catch {}
      document.documentElement.dataset.vrcrpLanguage = simplified() ? 'zh-Hans' : 'site';
    } finally { applying = false; }
    schedule();
  }
  function bind(value) {
    if (i18n || !value?.services?.backendConnector?.backend || typeof value.changeLanguage !== 'function') return;
    i18n = value;
    for (const [ns, bundle] of Object.entries(i18n.store?.data?.['zh-Hant'] || {})) originals.set(ns, copy(bundle));
    const backend = i18n.services.backendConnector.backend, read = backend.read.bind(backend);
    backend.read = (lng, ns, done) => read(lng, ns, (error, data) => {
      if (!error && data && typeof data === 'object') {
        if (lng === 'zh-Hant') data = capture(ns, data);
        else data = transform(data, ns);
      }
      done(error, data);
    });
    // Local preferences take precedence over the website's account locale.
    const change = i18n.changeLanguage.bind(i18n);
    i18n.changeLanguage = (lng, cb) => change(simplified() ? 'zh-Hant' : lng, cb);
    i18n.on('loaded', () => { if (!applying) schedule(); });
    repaint();
    if (simplified() && i18n.resolvedLanguage !== 'zh-Hant') i18n.changeLanguage('zh-Hant');
    window.__vrcrpI18n = i18n;
  }
  async function discover() {
    if (i18n || loading) return;
    const script = document.querySelector('script[type="module"][src*="/assets/index-"]');
    if (!script || new URL(script.src, location.href).origin !== location.origin) return;
    loading = true;
    try {
      const module = await import(script.src);
      for (const exported of Object.values(module)) {
        if (exported && typeof exported.changeLanguage === 'function') { bind(exported); if (i18n) break; }
        // react-i18next exports a pure singleton getter. Never invoke hooks or
        // arbitrary app functions while inspecting the already loaded module.
        if (typeof exported !== 'function' || !/^\(\s*\)\s*=>\s*[\w$]+$/.test(Function.prototype.toString.call(exported))) continue;
        try { bind(exported()); } catch {}
        if (i18n) break;
      }
    } catch {} finally { loading = false; }
  }
  function select(value) {
    choice = value === 'zh-Hans' ? value : 'site';
    try { localStorage.setItem(key, choice); } catch {}
    repaint();
    if (simplified()) i18n?.changeLanguage('zh-Hant');
    schedule();
  }
  function update() {
    queued = false;
    discover();
    const main = document.getElementById('main');
    if (!main) return;
    // Also remove the note if a page was rendered before the locale loaded.
    if (/^\/matches\/[^/]+$/.test(location.pathname)) for (const p of main.querySelectorAll('p')) {
      if (/^聊天[記记][錄录]存在[這这][個个][瀏浏][覽览]器[。.]?$/.test(p.textContent.trim()) ||
          p.textContent.trim() === 'Chat history is stored in this browser.') p.hidden = true;
    }
    if (location.pathname !== '/settings/language') { document.getElementById('vrcrp-simplified-language')?.remove(); return; }
    if (!document.getElementById('vrcrp-simplified-language')) {
      const button = document.createElement('button');
      button.id = 'vrcrp-simplified-language'; button.type = 'button'; button.className = 'card mb-3 flex w-full items-center justify-between p-4 font-semibold';
      button.textContent = '简体中文'; button.addEventListener('click', () => select('zh-Hans'));
      const heading = main.querySelector('h1')?.closest('.mb-4,.mb-5') || main.querySelector('h1');
      if (heading) heading.after(button); else main.prepend(button);
    }
    const button = document.getElementById('vrcrp-simplified-language');
    const pressed = String(simplified());
    if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
    button.style.color = simplified() ? 'rgb(var(--primary))' : 'rgb(var(--fg))';
  }
  function schedule() { if (!queued) { queued = true; queueMicrotask(update); } }
  document.addEventListener('click', event => {
    if (location.pathname !== '/settings/language' || event.target.closest('#vrcrp-simplified-language')) return;
    if (event.target.closest('#main button,#main [role="radio"]')) select('site');
  }, true);
  new MutationObserver(schedule).observe(document, {childList:true,subtree:true});
  window.addEventListener('popstate', schedule);
  window.__vrcrpLanguage = {select, current:() => choice};
  schedule();
})();
