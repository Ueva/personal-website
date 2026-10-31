// Optional integration checks: Node.js 22+ and a local Chromium browser; no npm packages.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const root = path.resolve(__dirname, '../_site');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon' };

async function main() {
  assert.ok(fs.existsSync(path.join(root, 'index.html')), 'Run build.ps1 first.');
  const executable = [process.env.BROWSER_BIN,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ].find(candidate => candidate && fs.existsSync(candidate));
  assert.ok(executable, 'Set BROWSER_BIN to a Chrome, Chromium, or Edge executable.');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'website-browser-'));
  // Delaying the deferred script makes an accidental dependency on it visible.
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404).end();
        return;
      }
      if (pathname.endsWith('/main.js')) await wait(1200);
      response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(fs.readFileSync(file));
    } catch {
      response.writeHead(400).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  let socket;
  try {
    browser = spawn(executable, ['--headless', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${temporary}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    const portFile = path.join(temporary, 'DevToolsActivePort');
    for (let i = 0; i < 300 && !fs.existsSync(portFile); i++) await wait(100);
    assert.ok(fs.existsSync(portFile), 'Browser did not start its debugging endpoint.');
    const port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(10000) })).json();
    socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let sequence = 0;
    const pending = new Map();
    const errors = [];
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject, timer } = pending.get(message.id);
        pending.delete(message.id);
        clearTimeout(timer);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      }
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
      if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) errors.push(message.params.response.url);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)); }, 20000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    // Do not send analytics events during automated checks.
    await send('Network.setBlockedURLs', { urls: ['*googletagmanager.com*', '*google-analytics.com*', '*cloudflareinsights.com*'] });
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    await send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1600000 / 8, uploadThroughput: 750000 / 8 });
    await send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.startup = { cls: 0, firstFrame: null };
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.startup.cls += entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
      function sample() {
        const header = document.querySelector('.site-header');
        const main = document.querySelector('main');
        if (!header || !main) { requestAnimationFrame(sample); return; }
        window.startup.firstFrame = {
          menu: getComputedStyle(document.querySelector('#site-nav')).display,
          themeHidden: document.querySelector('#theme-toggle').hidden,
          headerHeight: header.getBoundingClientRect().height
        };
      }
      requestAnimationFrame(sample);
    ` });
    const navigate = async (url, width, scale = 1, scripts = true) => {
      const previousTimeOrigin = await evaluate('performance.timeOrigin');
      await send('Emulation.setScriptExecutionDisabled', { value: !scripts });
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: scale, mobile: width < 600 });
      await send('Page.navigate', { url: base + url });
      for (let i = 0; i < 150; i++) {
        await wait(100);
        // Runtime evaluation also works while page-authored scripts are disabled.
        if (await evaluate(`performance.timeOrigin !== ${previousTimeOrigin} && location.pathname === ${JSON.stringify(url)} && document.readyState === 'complete'`)) break;
      }
      assert.ok(await evaluate(`performance.timeOrigin !== ${previousTimeOrigin} && document.readyState === 'complete'`), 'Page did not finish loading.');
      await evaluate('document.fonts.ready.then(() => true)');
      await wait(300);
      await send('Page.bringToFront');
    };
    for (const [width, scale] of [[390, 1.75], [412, 1.75], [1440, 1]]) {
      await navigate('/', width, scale);
      const result = await evaluate(`({ ...window.startup, overflow: document.documentElement.scrollWidth > innerWidth,
        image: document.querySelector('picture img').currentSrc,
        headerHeight: document.querySelector('.site-header').getBoundingClientRect().height })`);
      assert.equal(result.overflow, false);
      assert.ok(result.cls <= 0.1, `Excessive startup shift at ${width}px: ${JSON.stringify(result)}`);
      assert.ok(result.firstFrame && !result.firstFrame.themeHidden, 'Theme control appeared late.');
      assert.ok(Math.abs(result.firstFrame.headerHeight - result.headerHeight) < 1, 'Header changed height after first paint.');
      if (width < 600) {
        assert.equal(result.firstFrame.menu, 'none', 'Mobile menu flashed open.');
        assert.ok(!result.image.includes('-800.webp'), 'Phone unnecessarily downloaded the 800px portrait.');
        await evaluate('document.querySelector(".nav-toggle").focus(); document.querySelector(".nav-toggle").click()');
        assert.equal(await evaluate('document.querySelector(".nav-toggle").getAttribute("aria-expanded")'), 'true');
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
        assert.equal(await evaluate('document.querySelector(".nav-toggle").getAttribute("aria-expanded")'), 'false');
      }
      console.log(`Passed: cold startup at ${width}px, CLS ${result.cls.toFixed(4)}, portrait ${new URL(result.image).pathname}`);
    }
    await navigate('/publications.html', 390);
    await evaluate('Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("denied"); } } }); document.querySelector("[data-copy-bibtex]").click()');
    await wait(100);
    assert.ok(await evaluate('document.querySelector(".bibtex-fallback").open && document.activeElement.tagName === "TEXTAREA"'));
    await navigate('/publications.html', 390, 1, false);
    assert.ok(await evaluate('getComputedStyle(document.querySelector("#site-nav")).display !== "none"'));
    assert.equal(await evaluate('document.querySelector(".bibtex-fallback").hidden'), false);
    await navigate('/', 390);
    const modes = [];
    for (let i = 0; i < 3; i++) modes.push(await evaluate('document.querySelector("#theme-toggle").click(); document.documentElement.dataset.theme || "auto"'));
    assert.deepEqual(modes, ['light', 'dark', 'auto']);
    await evaluate('localStorage.setItem("theme", "dark")');
    await navigate('/phds.html', 390);
    assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark');
    assert.equal(await evaluate('document.querySelector("#theme-toggle").textContent'), 'Dark');
    const blockedStorage = await send('Page.addScriptToEvaluateOnNewDocument', { source: 'Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });' });
    await navigate('/', 390);
    const withoutStorage = [];
    for (let i = 0; i < 3; i++) withoutStorage.push(await evaluate('document.querySelector("#theme-toggle").click(); document.documentElement.dataset.theme || "auto"'));
    assert.deepEqual(withoutStorage, ['light', 'dark', 'auto']);
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: blockedStorage.identifier });
    assert.deepEqual(errors, []);
    console.log('Passed: menu controls, theme cycling, clipboard-denied fallback, no-JavaScript navigation/citations, and no browser/HTTP errors.');
  } finally {
    if (socket) socket.close();
    if (browser) browser.kill();
    server.closeAllConnections();
    server.close();
    // Leave the browser profile in the OS temp directory; Chromium may still hold locks.
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
