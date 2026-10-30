(() => {
  const data = document.getElementById('quotes-data');
  const text = document.getElementById('quote-text');
  const author = document.getElementById('quote-author');
  const button = document.getElementById('quote-toggle');
  const progress = document.querySelector('.quote-progress');
  if (!data || !text || !author || !button) return;

  const quotes = JSON.parse(data.textContent);
  if (quotes.length < 2) return;
  const interval = 15000;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reducedMotion.matches;
  let index = 0;
  let timer;
  let progressAnimation;

  let remaining = interval;
  let startedAt = null;

  function stop() {
    clearTimeout(timer);
    if (startedAt !== null) {
      remaining = Math.max(0, remaining - (performance.now() - startedAt));
      startedAt = null;
    }
    if (progressAnimation) {
      progressAnimation.pause();
      progressAnimation.currentTime = interval - remaining;
    }
  }

  function update() {
    stop();
    const label = paused ? 'Resume Quotes' : 'Pause Quotes';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.setAttribute('aria-pressed', String(paused));
    if (paused || document.hidden) return;
    const bar = progress?.firstElementChild;
    if (bar?.animate && !reducedMotion.matches) {
      if (!progressAnimation) {
        progressAnimation = bar.animate(
          [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
          { duration: interval, easing: 'linear', fill: 'forwards' }
        );
      }
      progressAnimation.currentTime = interval - remaining;
      progressAnimation.play();
    }
    startedAt = performance.now();
    timer = setTimeout(() => {
      startedAt = null;
      remaining = interval;
      progressAnimation?.cancel();
      progressAnimation = null;
      index = (index + 1 + Math.floor(Math.random() * (quotes.length - 1))) % quotes.length;
      // HTML is rendered once by Jekyll from trusted, locally maintained quote data.
      text.innerHTML = quotes[index].html;
      author.textContent = `\u2013 ${quotes[index].author}`;
      update();
    }, remaining);
  }

  button.hidden = false;
  button.addEventListener('click', () => { paused = !paused; update(); });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      paused = true;
      progressAnimation?.cancel();
      progressAnimation = null;
    }
    update();
  });
  document.addEventListener('visibilitychange', update);
  update();
})();
