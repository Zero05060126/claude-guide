/* ============================================================
   学习专注 - 防分心助手 · Popup Script
   ============================================================ */

const $ = (s) => document.querySelector(s);

let enabled = true;

async function init() {
  enabled = await chrome.runtime.sendMessage({ action: 'getEnabled' });
  updateToggle();
  const stats = await chrome.runtime.sendMessage({ action: 'getStats' });
  renderStats(stats);
  const sites = await chrome.runtime.sendMessage({ action: 'getBlockedSites' });
  renderSites(sites);
  const url = await chrome.runtime.sendMessage({ action: 'getRedirectUrl' });
  const builtIn = chrome.runtime.getURL('focus.html');
  $('#redirectUrl').value = url !== builtIn ? url : '';
  $('#redirectUrl').placeholder = `默认: ${builtIn}`;
}

function updateToggle() {
  $('#toggleEnabled').classList.toggle('active', enabled);
}

$('#toggleEnabled').addEventListener('click', async () => {
  enabled = !enabled;
  updateToggle();
  await chrome.storage.local.set({ enabled });
});

function renderStats(stats) {
  $('#statTotal').textContent = stats.total || 0;
  let topSite = '-';
  let topCount = 0;
  for (const [site, count] of Object.entries(stats.bySite || {})) {
    if (count > topCount) { topCount = count; topSite = site; }
  }
  if (topSite.length > 18) topSite = topSite.slice(0, 16) + '...';
  $('#statTop').textContent = topSite === '-' ? '-' : topSite;
}

function renderSites(sites) {
  const container = $('#siteList');
  container.innerHTML = sites.map(site =>
    `<div class="site-item">
      <span>${escapeHTML(site)}</span>
      <button data-site="${escapeHTML(site)}" title="移除">×</button>
    </div>`
  ).join('');
  container.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const site = btn.dataset.site;
      const sites = await chrome.runtime.sendMessage({ action: 'getBlockedSites' });
      const updated = sites.filter(s => s !== site);
      await chrome.storage.local.set({ blocked_sites: updated });
      renderSites(updated);
    });
  });
}

$('#btnAdd').addEventListener('click', async () => {
  const input = $('#newSite');
  const site = input.value.trim().toLowerCase();
  if (!site) return;
  const sites = await chrome.runtime.sendMessage({ action: 'getBlockedSites' });
  if (!sites.includes(site)) {
    sites.push(site);
    await chrome.storage.local.set({ blocked_sites: sites });
    renderSites(sites);
  }
  input.value = '';
});

$('#newSite').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnAdd').click(); });

$('#redirectUrl').addEventListener('change', async () => {
  let url = $('#redirectUrl').value.trim();
  if (!url) url = chrome.runtime.getURL('focus.html');
  await chrome.storage.local.set({ redirect_url: url });
  const orig = $('#redirectUrl').style.borderColor;
  $('#redirectUrl').style.borderColor = '#4ade80';
  setTimeout(() => { $('#redirectUrl').style.borderColor = orig; }, 800);
});

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

init();
