/**
 * OmniClip - Popup Script
 */

let currentPageData = null;
let currentTab = null;

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  if (tab && tab.id) {
    initPageInfo(tab);
  }

  checkBackendStatus();

  // Setup button handlers
  document.getElementById('btnQuickClip').addEventListener('click', handleQuickClip);
  document.getElementById('btnOpenSidepanel').addEventListener('click', handleOpenSidepanel);

  // Sync dashboard link with user settings
  const settings = await chrome.storage.sync.get(['apiUrl']);
  if (settings.apiUrl) {
    document.getElementById('openDashboardLink').href = settings.apiUrl;
  }
});

/**
 * Request page information from content script
 */
async function initPageInfo(tab) {
  try {
    const pageFavicon = document.getElementById('pageFavicon');
    const pageDomain = document.getElementById('pageDomain');
    const pageTitle = document.getElementById('pageTitle');
    const metaWordCount = document.getElementById('metaWordCount');
    const metaReadTime = document.getElementById('metaReadTime');

    if (tab.url) {
      try {
        pageDomain.innerText = new URL(tab.url).hostname;
      } catch (e) {
        pageDomain.innerText = 'Local / Browser Tab';
      }
    }

    if (tab.title) {
      pageTitle.innerText = tab.title;
    }

    if (tab.favIconUrl) {
      pageFavicon.src = tab.favIconUrl;
    }

    // Attempt to query content script for full metrics
    chrome.tabs.sendMessage(tab.id, { action: 'GET_PAGE_DATA' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        // Content script might not be injected yet
        return;
      }

      currentPageData = response;
      if (response.favicon) pageFavicon.src = response.favicon;
      if (response.title) pageTitle.innerText = response.title;
      if (response.domain) pageDomain.innerText = response.domain;
      
      const words = response.wordCount || 0;
      metaWordCount.innerText = `${words} words`;
      const readMins = Math.max(1, Math.ceil(words / 200));
      metaReadTime.innerText = `${readMins} min read`;
    });
  } catch (err) {
    console.error('Error fetching page info:', err);
  }
}

/**
 * Check if the OmniClip Cloud backend is reachable
 */
async function checkBackendStatus() {
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.getElementById('statusText');

  try {
    const settings = await chrome.storage.sync.get(['apiUrl']);
    const apiUrl = settings.apiUrl || 'http://localhost:3000';

    const res = await fetch(`${apiUrl}/api/clips`, { method: 'GET', signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      statusDot.style.backgroundColor = '#10b981';
      statusText.innerText = 'Connected';
    } else {
      statusDot.style.backgroundColor = '#f59e0b';
      statusText.innerText = 'Local Mode';
    }
  } catch (e) {
    // Backend offline / not started yet
    statusDot.style.backgroundColor = '#6366f1';
    statusText.innerText = 'Ready (Syncs on launch)';
  }
}

/**
 * Handle quick clip button click
 */
async function handleQuickClip() {
  const btn = document.getElementById('btnQuickClip');
  const originalHTML = btn.innerHTML;

  try {
    btn.innerHTML = `
      <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
      </svg>
      <span>Saving...</span>
    `;
    btn.disabled = true;

    const payload = currentPageData || {
      title: currentTab?.title || 'Saved Page',
      url: currentTab?.url || '',
      domain: currentTab?.url ? new URL(currentTab.url).hostname : '',
      content: 'Clipped from OmniClip quick action.',
      tags: ['quick-clip']
    };

    const settings = await chrome.storage.sync.get(['apiUrl', 'apiKey']);
    const apiUrl = settings.apiUrl || 'http://localhost:3000';

    try {
      const res = await fetch(`${apiUrl}/api/clips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey ? { 'Authorization': `Bearer ${settings.apiKey}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('API save error');
    } catch (apiErr) {
      // Save locally to storage as backup
      const local = await chrome.storage.local.get(['offlineClips']);
      const clips = local.offlineClips || [];
      clips.unshift({
        ...payload,
        id: 'clip-' + Date.now(),
        createdAt: new Date().toISOString()
      });
      await chrome.storage.local.set({ offlineClips: clips });
    }

    // Notify tab
    if (currentTab?.id) {
      chrome.tabs.sendMessage(currentTab.id, {
        action: 'SHOW_TOAST',
        message: 'Saved to your Second Brain!'
      }).catch(() => {});
    }

    // Success animation on button
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span style="color: #10b981;">Saved!</span>
    `;

    setTimeout(() => {
      window.close();
    }, 1000);
  } catch (error) {
    btn.innerHTML = originalHTML;
    btn.disabled = false;
    alert('Could not save clip. Please ensure OmniClip Web is running.');
  }
}

/**
 * Open the Chrome Side Panel or Universal Companion Window (Opera, Brave, Edge, Firefox)
 */
async function handleOpenSidepanel() {
  let opened = false;

  // 1. Try native chrome.sidePanel API
  if (chrome.sidePanel && typeof chrome.sidePanel.open === 'function') {
    try {
      const currentWin = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: currentWin.id });
      opened = true;
    } catch (e) {
      try {
        if (currentTab?.id) {
          await chrome.sidePanel.open({ tabId: currentTab.id });
          opened = true;
        }
      } catch (e2) {}
    }
  }

  // 2. Universal Fallback for Opera GX, Brave, Edge, or browsers without sidePanel API
  if (!opened) {
    try {
      const currentWin = await chrome.windows.getCurrent();
      const width = 420;
      const height = 760;
      const left = Math.max(0, (currentWin.left || 0) + (currentWin.width || 1200) - width);
      const top = Math.max(0, currentWin.top || 40);

      await chrome.windows.create({
        url: chrome.runtime.getURL('sidepanel.html'),
        type: 'popup',
        width: width,
        height: height,
        left: left,
        top: top,
        focused: true
      });
    } catch (winErr) {
      // If window creation fails, open in a side tab
      chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
    }
  }

  window.close();
}
