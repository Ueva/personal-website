// Run before the stylesheet so a saved theme is applied before first paint.
(() => {
  const root = document.documentElement;
  const modes = ['auto', 'light', 'dark'];
  let mode = 'auto';
  try {
    const saved = localStorage.getItem('theme');
    if (modes.includes(saved)) mode = saved;
  } catch {
    // Storage is optional; the current selection still lives in memory.
  }

  function applyTheme() {
    if (mode === 'auto') root.removeAttribute('data-theme');
    else root.dataset.theme = mode;
    root.style.colorScheme = mode === 'auto' ? 'light dark' : mode;
  }
  applyTheme();

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    function updateLabel() {
      button.textContent = mode[0].toUpperCase() + mode.slice(1);
      button.setAttribute('aria-label', `Colour theme: ${mode}. Switch to ${modes[(modes.indexOf(mode) + 1) % modes.length]}.`);
    }
    updateLabel();
    button.hidden = false;
    button.addEventListener('click', () => {
      mode = modes[(modes.indexOf(mode) + 1) % modes.length];
      applyTheme();
      updateLabel();
      try { localStorage.setItem('theme', mode); } catch { /* Keep working without storage. */ }
    });
  });
})();
