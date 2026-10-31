// Inline before CSS: apply the saved theme without an extra blocking request.
(() => {
  const root = document.documentElement;
  let mode = 'auto';
  try {
    const saved = localStorage.getItem('theme');
    if (['light', 'dark'].includes(saved)) mode = saved;
  } catch {
    // Storage is optional; controls still work without persistence.
  }
  if (mode !== 'auto') root.dataset.theme = mode;
  root.style.colorScheme = mode === 'auto' ? 'light dark' : mode;
})();
