// Site Auto Reload - background service worker
const ALARM = "autoReload";
const DEFAULTS = {
  enabled: true,
  intervalSec: 60,
  patterns: [],          // 例: https://example.com/* , *zabbix*
  bypassCache: false,
  skipActive: false
};

async function getSettings() {
  return { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
}

async function setupAlarm() {
  const s = await getSettings();
  await chrome.alarms.clear(ALARM);
  if (!s.enabled || s.patterns.length === 0) return;
  const sec = Math.max(30, Number(s.intervalSec) || 60); // Chrome alarms の実用下限は30秒
  chrome.alarms.create(ALARM, { periodInMinutes: sec / 60 });
}

function matches(url, patterns) {
  if (!url) return false;
  return patterns.some(p => {
    p = p.trim();
    if (!p) return false;
    if (!p.includes("*")) return url.includes(p);
    const re = new RegExp("^" + p.split("*").map(x =>
      x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
    return re.test(url);
  });
}

async function reloadMatching() {
  const s = await getSettings();
  if (!s.enabled || s.patterns.length === 0) return 0;
  const tabs = await chrome.tabs.query({});
  let n = 0;
  for (const t of tabs) {
    if (!matches(t.url, s.patterns)) continue;
    if (s.skipActive && t.active) continue;
    try { await chrome.tabs.reload(t.id, { bypassCache: !!s.bypassCache }); n++; } catch {}
  }
  await chrome.storage.local.set({ lastReload: Date.now(), lastCount: n });
  return n;
}

chrome.runtime.onInstalled.addListener(setupAlarm);
chrome.runtime.onStartup.addListener(setupAlarm);
chrome.storage.onChanged.addListener((c, area) => { if (area === "sync") setupAlarm(); });
chrome.alarms.onAlarm.addListener(a => { if (a.name === ALARM) reloadMatching(); });
chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (msg.type === "reloadNow") reloadMatching().then(n => reply({ count: n }));
  if (msg.type === "setup") setupAlarm().then(() => reply({ ok: true }));
  return true;
});
