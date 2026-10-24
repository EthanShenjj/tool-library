/* global chrome, importScripts */
importScripts("platforms.js", "shared.js");

const core = globalThis.AccountCapture;
let managedTabId = null;
let setup = null;
let saving = false;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function findTab() {
  const tabs = await chrome.tabs.query({ url: `${core.TOOL_URL}*` });
  const tab = tabs.find((item) => core.isToolPage(item.url));
  if (tab) { managedTabId = tab.id; return tab; }
  if (managedTabId !== null) {
    try { return await chrome.tabs.get(managedTabId); }
    catch { managedTabId = null; }
  }
  const created = await chrome.tabs.create({ url: core.TOOL_URL, active: false });
  managedTabId = created.id;
  return created;
}

async function prepareBridge() {
  let tab = await findTab();
  const deadline = Date.now() + 20_000;
  while (tab.status !== "complete" && Date.now() < deadline) {
    await sleep(150);
    try { tab = await chrome.tabs.get(tab.id); }
    catch { throw core.failure("CONNECTION_ERROR", "工具台标签页已关闭，请重试。"); }
  }
  if (!core.isToolPage(tab.url)) throw core.failure("AUTH_REQUIRED", "请先在同一 Chrome 中登录工具台，再重新打开插件。");
  if (tab.status !== "complete") throw core.failure("CONNECTION_ERROR", "工具台加载超时，请稍后重试。");
  const ping = () => chrome.tabs.sendMessage(tab.id, { channel: "ACCOUNT_CAPTURE_BRIDGE", action: "PING" }, { frameId: 0 });
  try {
    if ((await ping())?.ok) return tab.id;
  } catch { /* Existing tabs may predate installation. Inject without reloading their editor. */ }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: "ISOLATED", files: ["platforms.js", "shared.js", "bridge.js"] });
    if ((await ping())?.ok) return tab.id;
  } catch { /* A redirect to the login page also prevents injection. */ }
  throw core.failure("AUTH_REQUIRED", "无法连接工具台，请先打开工具台确认已登录，再重试。");
}

async function bridge() {
  setup ??= prepareBridge().finally(() => { setup = null; });
  return setup;
}

async function handle(message) {
  if (message.type === "CAPTURE_CONTEXT") {
    let [tab] = await chrome.tabs.query(Number.isInteger(message.windowId) && message.windowId >= 0
      ? { active: true, windowId: message.windowId }
      : { active: true, lastFocusedWindow: true });
    if (!tab) {
      // Chrome's action popup can briefly own focus without exposing a tab.
      const windows = await chrome.windows.getAll({ windowTypes: ["normal"] });
      const focused = windows.find((window) => window.focused);
      if (focused) [tab] = await chrome.tabs.query({ active: true, windowId: focused.id });
    }
    const url = core.validWebsite(tab?.url) ? tab.url : "";
    return { url, platform: core.recognizePlatform(url).name };
  }
  if (message.type === "OPEN_MANAGER") {
    const tab = await findTab();
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    return { opened: true };
  }
  const mapping = { CHECK_CONNECTION: "CHECK", PREPARE_SAVE: "SAVE", CREATE_ACCOUNT: "CREATE", UPDATE_ACCOUNT: "UPDATE" };
  const action = Object.hasOwn(mapping, message.type) ? mapping[message.type] : null;
  if (!action) throw core.failure("INVALID_MESSAGE", "不支持的操作。");
  const mutation = action !== "CHECK";
  const input = mutation ? core.validateInput(message.input) : undefined;
  if (mutation && saving) throw core.failure("BUSY", "正在保存，请稍候。");
  if (mutation) saving = true;
  try {
    const tabId = await bridge();
    let response;
    try { response = await chrome.tabs.sendMessage(tabId, { channel: "ACCOUNT_CAPTURE_BRIDGE", action, input, id: message.id }, { frameId: 0 }); }
    catch { throw core.failure("CONNECTION_ERROR", "工具台连接已中断，请重新连接后重试。"); }
    if (!response?.ok) throw core.failure(response?.error?.code || "CONNECTION_ERROR", response?.error?.message || "连接中断，请重试。");
    return response.data;
  } finally { if (mutation) saving = false; }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL("popup.html") || message?.channel !== "ACCOUNT_CAPTURE_POPUP") return;
  handle(message).then((data) => sendResponse({ ok: true, data })).catch((error) => sendResponse({ ok: false, error: { code: error.code || "CONNECTION_ERROR", message: error.code ? error.message : "无法连接工具台，请检查网络后重试。" } }));
  return true;
});
