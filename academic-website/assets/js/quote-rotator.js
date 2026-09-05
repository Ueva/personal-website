document.addEventListener('DOMContentLoaded', () => {
  const quotesEl = document.getElementById('quotes-data');
  const quoteText = document.getElementById('quote-text');
  const quoteAuthor = document.getElementById('quote-author');
  const progress = document.querySelector('.quote-progress');
  const quoteIntervalMs = 20000;

  if (!quotesEl || !quoteText || !quoteAuthor) return;

  try {
    const quotes = JSON.parse(quotesEl.textContent);
    if (!Array.isArray(quotes) || !quotes.length) return;

    let currentQuoteIndex = -1;

    function getRandomQuoteIndex() {
      if (quotes.length === 1) return 0;

      let nextQuoteIndex = currentQuoteIndex;
      while (nextQuoteIndex === currentQuoteIndex) {
        nextQuoteIndex = Math.floor(Math.random() * quotes.length);
      }

      return nextQuoteIndex;
    }

    function restartProgress() {
      if (!progress) return;

      progress.style.setProperty('--quote-cycle-duration', `${quoteIntervalMs}ms`);
      progress.classList.remove('is-running');
      void progress.offsetWidth;
      progress.classList.add('is-running');
    }

    function showRandomQuote() {
      currentQuoteIndex = getRandomQuoteIndex();
      const quote = quotes[currentQuoteIndex];
      if (!quote) return;

      quoteText.textContent = `\u201c${quote.text}\u201d`;
      quoteAuthor.textContent = `\u2013 ${quote.author}`;
      restartProgress();
    }

    showRandomQuote();

    if (quotes.length > 1) {
      window.setInterval(showRandomQuote, quoteIntervalMs);
    }
  } catch (error) {
    console.warn('Unable to parse quotes data', error);
  }
});
