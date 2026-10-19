/**
 * OmniClip - Content Script
 * Extracts clean DOM article content, metadata, and displays in-page notifications.
 */

// Listen for messages from popup, side panel, or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_PAGE_DATA') {
    const data = extractPageData();
    sendResponse(data);
    return true;
  }

  if (request.action === 'SHOW_TOAST') {
    showToast(request.message, request.type || 'success');
    sendResponse({ success: true });
    return true;
  }
});

/**
 * Extracts clean page content, metadata, and selections
 */
function extractPageData() {
  const selection = window.getSelection() ? window.getSelection().toString().trim() : '';

  // Metadata
  const title = document.title || 'Untitled Page';
  const url = window.location.href;
  const domain = window.location.hostname;
  
  // Favicon
  let favicon = '';
  const iconLink = document.querySelector('link[rel~="icon"]') || document.querySelector('link[rel="apple-touch-icon"]');
  if (iconLink && iconLink.href) {
    favicon = iconLink.href;
  } else {
    favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  }

  // Meta description & author
  const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') ||
                   document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
  const author = document.querySelector('meta[name="author"]')?.getAttribute('content') ||
                 document.querySelector('meta[property="article:author"]')?.getAttribute('content') || domain;

  // Clean article content in markdown
  const markdownContent = extractArticleMarkdown();

  return {
    title,
    url,
    domain,
    favicon,
    description: metaDesc,
    author,
    selection,
    content: markdownContent,
    wordCount: markdownContent.split(/\s+/).filter(Boolean).length
  };
}

/**
 * Clean text extractor converting HTML to clean readable text/markdown
 */
function extractArticleMarkdown() {
  // Try main semantic containers first
  let container = document.querySelector('article') ||
                  document.querySelector('main') ||
                  document.querySelector('[role="main"]') ||
                  document.querySelector('.post-content') ||
                  document.querySelector('.article-content');

  // If container is missing or has very little text, use document.body
  if (!container || (container.innerText && container.innerText.trim().length < 400)) {
    container = document.body;
  }

  if (!container) return document.body ? document.body.innerText.slice(0, 50000) : '';

  const clone = container.cloneNode(true);

  // Strip non-content and clutter elements
  const tagsToRemove = [
    'script', 'style', 'noscript', 'iframe', 'svg', 'nav', 'footer',
    'header', 'aside', 'form', 'button', 'input', 'select', 'textarea',
    '.ad', '.ads', '.advertisement', '.sidebar', '.cookie-banner', '.modal',
    '#comments', '.comments'
  ];

  tagsToRemove.forEach(selector => {
    try {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    } catch (e) {}
  });

  // Extract clean structured paragraphs, headings, code, tables, and lists
  let markdown = '';
  const elements = clone.querySelectorAll('h1, h2, h3, h4, h5, h6, p, pre, ul, ol, blockquote, table');

  if (elements.length === 0) {
    return clone.innerText.replace(/\n\s*\n/g, '\n\n').trim().slice(0, 80000);
  }

  elements.forEach(el => {
    const text = el.innerText.trim();
    if (!text) return;

    const tag = el.tagName.toLowerCase();
    switch (tag) {
      case 'h1':
        markdown += `\n# ${text}\n\n`;
        break;
      case 'h2':
        markdown += `\n## ${text}\n\n`;
        break;
      case 'h3':
        markdown += `\n### ${text}\n\n`;
        break;
      case 'pre':
        markdown += `\n\`\`\`\n${text}\n\`\`\`\n\n`;
        break;
      case 'blockquote':
        markdown += `\n> ${text}\n\n`;
        break;
      case 'ul':
      case 'ol':
        el.querySelectorAll('li').forEach(li => {
          const liText = li.innerText.trim();
          if (liText) markdown += `- ${liText}\n`;
        });
        markdown += '\n';
        break;
      case 'p':
        markdown += `${text}\n\n`;
        break;
    }
  });

  return markdown.trim().slice(0, 80000); // 80k character deep extraction
}

/**
 * Modern floating toast
 */
function showToast(message, type = 'success') {
  const existing = document.getElementById('omniclip-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'omniclip-toast';
  
  const icon = type === 'success' ? '✓' : 'ℹ';
  toast.innerHTML = `
    <div style="
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      background: #18181b;
      color: #fafafa;
      padding: 12px 20px;
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      animation: omniclipFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    ">
      <span style="
        background: #6366f1;
        color: white;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
      ">${icon}</span>
      <span>${message}</span>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes omniclipFadeIn {
      from { opacity: 0; transform: translateY(12px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast && toast.parentElement) {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }
  }, 3200);
}
