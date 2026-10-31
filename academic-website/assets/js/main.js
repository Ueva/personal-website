// This script is deferred: the document is ready when it runs.
(() => {
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

  initBibtexCopy();
})();
