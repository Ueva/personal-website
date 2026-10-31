// Inline immediately after the header: controls are ready before deferred scripts load.
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

  function initThemeControls() {
    const root = document.documentElement;
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    const modes = ['auto', 'light', 'dark'];
    let mode = root.dataset.theme || 'auto';

    function updateLabel() {
      button.textContent = mode[0].toUpperCase() + mode.slice(1);
      button.setAttribute('aria-label', `Colour theme: ${mode}. Switch to ${modes[(modes.indexOf(mode) + 1) % modes.length]}.`);
    }
    updateLabel();
    button.hidden = false;
    button.addEventListener('click', () => {
      mode = modes[(modes.indexOf(mode) + 1) % modes.length];
      if (mode === 'auto') root.removeAttribute('data-theme');
      else root.dataset.theme = mode;
      root.style.colorScheme = mode === 'auto' ? 'light dark' : mode;
      updateLabel();
      try { localStorage.setItem('theme', mode); } catch { /* Keep working without storage. */ }
    });
  }

  initNavigation();
  initThemeControls();
})();
