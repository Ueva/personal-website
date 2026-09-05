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

    function sanitizeQuoteHtml(html) {
      const allowedTags = new Set(['B', 'BR', 'EM', 'I', 'STRONG']);
      const template = document.createElement('template');
      template.innerHTML = html;

      function cleanNode(node) {
        Array.from(node.childNodes).forEach((child) => {
          if (child.nodeType !== Node.ELEMENT_NODE) return;

          if (!allowedTags.has(child.tagName)) {
            child.replaceWith(document.createTextNode(child.textContent));
            return;
          }

          Array.from(child.attributes).forEach((attribute) => {
            child.removeAttribute(attribute.name);
          });

          cleanNode(child);
        });
      }

      cleanNode(template.content);
      return template.innerHTML;
    }

    function formatQuoteText(text) {
      const quoteHtml = String(text)
        .replace(/\r\n?/g, '\n')
        .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/gs, '<em>$1</em>')
        .replace(/\n/g, '<br>');

      return `\u201c${sanitizeQuoteHtml(quoteHtml)}\u201d`;
    }

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

      quoteText.innerHTML = formatQuoteText(quote.text);
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
