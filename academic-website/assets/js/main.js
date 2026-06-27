// Mobile nav toggle (no dependencies)
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('#site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      nav.setAttribute('aria-expanded', String(!expanded));
    });
  }

  // Theme toggle (auto → light → dark)
  const THEME_KEY = 'theme'; // values: 'auto' | 'light' | 'dark'
  const root = document.documentElement;
  const btn = document.getElementById('theme-toggle');

  function applyTheme(mode) {
    if (mode === 'light') {
      root.setAttribute('data-theme', 'light');
      if (btn) btn.textContent = 'Light';
    } else if (mode === 'dark') {
      root.setAttribute('data-theme', 'dark');
      if (btn) btn.textContent = 'Dark';
    } else {
      root.removeAttribute('data-theme');
      if (btn) btn.textContent = 'Auto';
    }
  }

  const saved = localStorage.getItem(THEME_KEY) || 'auto';
  applyTheme(saved);

  if (btn) {
    btn.addEventListener('click', () => {
      const current = localStorage.getItem(THEME_KEY) || 'auto';
      const next = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });
  }

  // If user is in Auto mode, respect system changes live
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener?.('change', () => {
    const mode = localStorage.getItem(THEME_KEY) || 'auto';
    if (mode === 'auto') applyTheme('auto');
  });

  // Random quote (if present on page)
  const quotesEl = document.getElementById('quotes-data');
  if (quotesEl) {
    try {
      const quotes = JSON.parse(quotesEl.textContent);
      if (Array.isArray(quotes) && quotes.length) {
        const q = quotes[Math.floor(Math.random() * quotes.length)];
        const qt = document.getElementById('quote-text');
        const qa = document.getElementById('quote-author');
        if (qt && qa && q) {
          qt.textContent = `“${q.text}”`;
          qa.textContent = `– ${q.author}`;
        }
      }
    } catch (e) {
      console.warn('Unable to parse quotes data', e);
    }
  }

});