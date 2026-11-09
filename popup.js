const $ = id => document.getElementById(id);
const DEFAULTS = { enabled:true, intervalSec:60, patterns:[], bypassCache:false, skipActive:false };

async function load(){
  const s = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
  $("enabled").checked = s.enabled;
  $("patterns").value = (s.patterns||[]).join("\n");
  $("intervalSec").value = s.intervalSec;
  $("bypassCache").checked = s.bypassCache;
  $("skipActive").checked = s.skipActive;
  const tabs = await chrome.tabs.query({});
  const pats = s.patterns||[];
  const hit = tabs.filter(t=>pats.some(p=>t.url && (p.includes("*") ? new RegExp("^"+p.split("*").map(x=>x.replace(/[.+?^${}()|[\]\\]/g,"\\$&")).join(".*")+"$").test(t.url) : t.url.includes(p))));
  $("status").textContent = pats.length ? `対象タブ: ${hit.length}件` : "対象サイトを入力して保存してください";
}
$("save").onclick = async () => {
  const patterns = $("patterns").value.split("\n").map(x=>x.trim()).filter(Boolean);
  await chrome.storage.sync.set({
    enabled: $("enabled").checked,
    intervalSec: Math.max(30, Number($("intervalSec").value)||60),
    patterns, bypassCache: $("bypassCache").checked, skipActive: $("skipActive").checked
  });
  await chrome.runtime.sendMessage({type:"setup"});
  $("status").textContent = "保存しました";
  load();
};
$("now").onclick = async () => {
  const r = await chrome.runtime.sendMessage({type:"reloadNow"});
  $("status").textContent = `リロードしました: ${r?.count ?? 0}件`;
};
load();
