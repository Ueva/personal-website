// This script is deferred: the document is ready when it runs.
(() => {
  function initNavigation() {
    const header = document.querySelector('.site-header');
    const button = document.querySelector('.nav-toggle');
    const nav = document.getElementById('site-nav');
    if (!header || !button || !nav) return;

    function closeMenu(restoreFocus = false) {
      if ((restoreFocus || nav.contains(document.activeElement)) && getComputedStyle(button).display !== 'none') {
        button.focus();
      }
      nav.classList.remove('open');
      button.setAttribute('aria-expanded', 'false');
    }
    button.addEventListener('click', () => {
      const open = !nav.classList.contains('open');
      nav.classList.toggle('open', open);
      button.setAttribute('aria-expanded', String(open));
    });
    header.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('open')) {
        closeMenu(true);
        event.preventDefault();
      }
    });
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMenu();
    });
    header.addEventListener('focusout', (event) => {
      if (!header.contains(event.relatedTarget)) closeMenu();
    });
    document.addEventListener('click', (event) => {
      if (!header.contains(event.target)) closeMenu();
    });
    window.addEventListener('resize', () => {
      // CSS owns the breakpoint; avoid a second hard-coded copy in JavaScript.
      if (getComputedStyle(button).display === 'none') closeMenu();
      else if (!nav.classList.contains('open') && nav.contains(document.activeElement)) button.focus();
    });
    header.classList.add('nav-enhanced');
  }

  function initBibtexCopy() {
    let active;
    let fadeTimer;
    let clearTimer;
    let request = 0;

    function clearFeedback() {
      clearTimeout(fadeTimer);
      clearTimeout(clearTimer);
      if (!active) return;
      active.status.textContent = '';
      active.status.classList.remove('is-fading');
      active.fallback.hidden = true;
      active.fallback.open = false;
      active = null;
    }

    document.querySelectorAll('.bibtex-copy').forEach((container) => {
      const button = container.querySelector('[data-copy-bibtex]');
      const source = container.querySelector('[data-bibtex-source]');
      const status = container.querySelector('[data-bibtex-status]');
      const fallback = container.querySelector('details');
      if (!button || !source || !status || !fallback) return;
      const summary = fallback.querySelector('summary');
      summary.classList.remove('button');
      summary.textContent = 'Citation text';
      button.hidden = false;
      fallback.hidden = true;
      button.addEventListener('click', async () => {
        const currentRequest = ++request;
        clearFeedback();
        button.disabled = true;
        try {
          await navigator.clipboard.writeText(source.value);
          if (currentRequest !== request) return;
          active = { status, fallback };
          status.textContent = 'Copied!';
          fadeTimer = setTimeout(() => status.classList.add('is-fading'), 1500);
          clearTimer = setTimeout(clearFeedback, 2000);
        } catch {
          if (currentRequest !== request) return;
          active = { status, fallback };
          fallback.hidden = false;
          fallback.open = true;
          status.textContent = 'Copy the selected citation below.';
          source.focus();
          source.select();
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  initNavigation();
  initBibtexCopy();
})();
