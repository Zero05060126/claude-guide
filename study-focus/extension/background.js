/* ============================================================
   学习专注 - 防分心助手 · Background Service Worker
   ============================================================ */

// ---------- Default blocked domains ----------
const DEFAULT_BLOCKED = [
  'bilibili.com',
  'douyin.com',
  'youtube.com',
  'twitter.com',
  'x.com',
  'weibo.com',
  'zhihu.com',
  'reddit.com',
  'iqiyi.com',
  'youku.com',
  'tiktok.com',
  'douyu.com',
  'huya.com',
  'qq.com/xiuxian',
  'wegame.com.cn',
  'taobao.com',
  'jd.com',
];

// ---------- Storage keys ----------
const KEYS = {
  blocked: 'blocked_sites',
  enabled: 'enabled',
  redirectUrl: 'redirect_url',
  stats: 'stats',
};

// ---------- Helpers ----------
async function getBlockedSites() {
  const result = await chrome.storage.local.get(KEYS.blocked);
  return result[KEYS.blocked] || DEFAULT_BLOCKED;
}

async function isEnabled() {
  const result = await chrome.storage.local.get(KEYS.enabled);
  return result[KEYS.enabled] !== false;
}

async function getRedirectUrl() {
  const result = await chrome.storage.local.get(KEYS.redirectUrl);
  if (result[KEYS.redirectUrl]) return result[KEYS.redirectUrl];
  return chrome.runtime.getURL('focus.html');
}

async function recordRedirect(site) {
  const today = new Date().toISOString().split('T')[0];
  const result = await chrome.storage.local.get(KEYS.stats);
  const stats = result[KEYS.stats] || { date: '', total: 0, bySite: {} };
  if (stats.date !== today) {
    stats.date = today;
    stats.total = 0;
    stats.bySite = {};
  }
  stats.total += 1;
  stats.bySite[site] = (stats.bySite[site] || 0) + 1;
  await chrome.storage.local.set({ [KEYS.stats]: stats });
}

async function getStats() {
  const today = new Date().toISOString().split('T')[0];
  const result = await chrome.storage.local.get(KEYS.stats);
  const stats = result[KEYS.stats] || { date: '', total: 0, bySite: {} };
  if (stats.date !== today) {
    return { date: today, total: 0, bySite: {} };
  }
  return stats;
}

// ---------- URL Matching ----------
function matchesBlockedSite(url, blockedSites) {
  if (!url) return false;
  const lower = url.toLowerCase();
  // Never block browser internal pages
  if (
    lower.startsWith('chrome://') ||
    lower.startsWith('edge://') ||
    lower.startsWith('about:') ||
    lower.startsWith('file://') ||
    lower.startsWith('chrome-extension://') ||
    lower.startsWith('moz-extension://') ||
    lower.startsWith('devtools://')
  ) {
    return false;
  }
  for (const site of blockedSites) {
    if (lower.includes(site.toLowerCase())) {
      return site;
    }
  }
  return false;
}

// ---------- Main: intercept navigation ----------
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;

  const enabled = await isEnabled();
  if (!enabled) return;

  const blockedSites = await getBlockedSites();
  const matched = matchesBlockedSite(details.url, blockedSites);
  if (!matched) return;

  const redirectUrl = await getRedirectUrl();
  if (details.url.startsWith(redirectUrl)) return;

  await recordRedirect(matched);
  const targetUrl = redirectUrl + '?from=' + encodeURIComponent(matched);
  try {
    await chrome.tabs.update(details.tabId, { url: targetUrl });
  } catch (e) {
    console.log('Redirect failed:', e.message);
  }
});

// Fallback: tabs.onUpdated for SPA navigations
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;

  const enabled = await isEnabled();
  if (!enabled) return;

  const blockedSites = await getBlockedSites();
  const matched = matchesBlockedSite(changeInfo.url, blockedSites);
  if (!matched) return;

  const redirectUrl = await getRedirectUrl();
  if (changeInfo.url.startsWith(redirectUrl)) return;

  await recordRedirect(matched);
  const targetUrl = redirectUrl + '?from=' + encodeURIComponent(matched);
  try {
    await chrome.tabs.update(tabId, { url: targetUrl });
  } catch (e) {
    console.log('Redirect failed:', e.message);
  }
});

// ---------- Handle messages from popup ----------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getStats') {
    getStats().then(stats => sendResponse(stats));
    return true;
  }
  if (message.action === 'getBlockedSites') {
    getBlockedSites().then(sites => sendResponse(sites));
    return true;
  }
  if (message.action === 'getEnabled') {
    isEnabled().then(enabled => sendResponse(enabled));
    return true;
  }
  if (message.action === 'getRedirectUrl') {
    getRedirectUrl().then(url => sendResponse(url));
    return true;
  }
});

console.log('📚 学习专注助手已启动 - 守护你的注意力');
