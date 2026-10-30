function onReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    callback();
  }
}

onReady(() => {
  let activeBibtexStatus;
  let bibtexFadeTimer;
  let bibtexClearTimer;

  function clearBibtexFeedback() {
    clearTimeout(bibtexFadeTimer);
    clearTimeout(bibtexClearTimer);
    if (activeBibtexStatus) {
      activeBibtexStatus.textContent = '';
      activeBibtexStatus.classList.remove('is-fading');
      activeBibtexStatus = null;
    }
  }
  document.querySelectorAll('[data-copy-bibtex]').forEach((button) => {
    const container = button.closest('.bibtex-copy');
    const source = container.querySelector('[data-bibtex-source]');
    const status = container.querySelector('[data-bibtex-status]');

    button.addEventListener('click', async () => {
      clearBibtexFeedback();
      button.disabled = true;
      status.textContent = '';
      try {
        await navigator.clipboard.writeText(source.value);
        source.hidden = true;
        clearBibtexFeedback();
        activeBibtexStatus = status;
        status.textContent = 'Copied!';
        bibtexFadeTimer = setTimeout(() => status.classList.add('is-fading'), 1500);
        bibtexClearTimer = setTimeout(clearBibtexFeedback, 2000);
      } catch (error) {
        source.hidden = false;
        source.focus();
        source.select();
        status.textContent = 'Could not copy automatically. Copy the selected citation below.';
      } finally {
        button.disabled = false;
      }
    });
  });

  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('#site-nav');
  const header = document.querySelector('.site-header');

  if (toggle && nav && header) {
    function setOverlayTop() {
      const height = header.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--overlay-top', `${height}px`);
    }

    function openNav() {
      setOverlayTop();
      nav.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('nav-lock');
      window.addEventListener('resize', setOverlayTop, { passive: true });
    }

    function closeNav() {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('nav-lock');
      window.removeEventListener('resize', setOverlayTop);
    }

    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (nav.classList.contains('open')) {
        closeNav();
      } else {
        openNav();
      }
    });

    nav.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (link) closeNav();
    });

    nav.addEventListener('click', (event) => {
      const list = nav.querySelector('ul');
      if (list && !list.contains(event.target)) closeNav();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeNav();
    });
  }

  // Theme toggle (auto -> light -> dark)
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

  function getStoredTheme() {
    try {
      return localStorage.getItem(THEME_KEY) || 'auto';
    } catch (error) {
      return 'auto';
    }
  }

  function setStoredTheme(mode) {
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch (error) {
      // Keep the toggle usable when storage is unavailable.
    }
  }

  const saved = getStoredTheme();
  applyTheme(saved);

  if (btn) {
    btn.addEventListener('click', () => {
      const current = getStoredTheme();
      const next = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
      setStoredTheme(next);
      applyTheme(next);
    });
  }

  // If user is in Auto mode, respect system changes live
  if (window.matchMedia) {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener?.('change', () => {
      const mode = getStoredTheme();
      if (mode === 'auto') applyTheme('auto');
    });
  }

});
