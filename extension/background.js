/**
 * OmniClip - Background Service Worker
 * Handles extension lifecycle, context menus, and side panel events.
 */

// Initialize on install or update
chrome.runtime.onInstalled.addListener(() => {
  // Setup side panel behavior
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }

  // Create Context Menus
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'omniclip-clip-selection',
      title: 'Clip Selection to OmniClip',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'omniclip-summarize-page',
      title: 'Summarize Page with OmniClip AI',
      contexts: ['page']
    });

    chrome.contextMenus.create({
      id: 'omniclip-open-sidepanel',
      title: 'Open OmniClip Side Panel',
      contexts: ['all']
    });
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;

  if (info.menuItemId === 'omniclip-open-sidepanel') {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId: tab.id });
    }
    return;
  }

  if (info.menuItemId === 'omniclip-clip-selection') {
    const selectedText = info.selectionText || '';
    if (!selectedText) return;

    // Send save command to backend
    await saveQuickClip({
      title: tab.title || 'Selected Quote',
      url: tab.url || '',
      content: selectedText,
      tags: ['quick-clip', 'quote'],
      domain: new URL(tab.url).hostname
    });

    // Notify tab with toast
    chrome.tabs.sendMessage(tab.id, {
      action: 'SHOW_TOAST',
      message: 'Selection saved to OmniClip!'
    }).catch(() => {});
  }

  if (info.menuItemId === 'omniclip-open-sidepanel' || info.menuItemId === 'omniclip-summarize-page') {
    let opened = false;
    if (chrome.sidePanel && typeof chrome.sidePanel.open === 'function') {
      try {
        await chrome.sidePanel.open({ tabId: tab.id });
        opened = true;
      } catch (e) {}
    }

    if (!opened) {
      chrome.windows.create({
        url: chrome.runtime.getURL('sidepanel.html'),
        type: 'popup',
        width: 420,
        height: 760,
        focused: true
      });
    }
    return;
  }
});

/**
 * Save clip directly to OmniClip cloud backend or local storage sync
 */
async function saveQuickClip(clipData) {
  const syncSettings = await chrome.storage.sync.get(['apiUrl', 'apiKey']);
  const apiUrl = syncSettings.apiUrl || 'http://localhost:3000';

  try {
    const response = await fetch(`${apiUrl}/api/clips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(syncSettings.apiKey ? { 'Authorization': `Bearer ${syncSettings.apiKey}` } : {})
      },
      body: JSON.stringify(clipData)
    });

    if (!response.ok) {
      throw new Error(`Failed to save: ${response.statusText}`);
    }

    return await response.json();
  } catch (err) {
    console.warn('[OmniClip Background] Cloud save failed, caching locally in storage:', err);
    // Cache offline
    const local = await chrome.storage.local.get(['offlineClips']);
    const offlineList = local.offlineClips || [];
    offlineList.unshift({
      ...clipData,
      id: 'local-' + Date.now(),
      createdAt: new Date().toISOString()
    });
    await chrome.storage.local.set({ offlineClips: offlineList });
  }
}
