/* global chrome */
(() => {
  const core = globalThis.AccountCapture;
  if (!core.isToolPage(location.href) || globalThis.__accountCaptureBridgeInstalled) return;
  globalThis.__accountCaptureBridgeInstalled = true;
  const actions = new Set(["PING", "CHECK", "SAVE", "CREATE", "UPDATE"]);

  async function api(path, method = "GET", body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(path, {
        method, credentials: "same-origin", mode: "same-origin", redirect: "manual", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (response.type === "opaqueredirect" || [0, 301, 302, 303, 307, 308, 401, 403].includes(response.status)) {
        throw core.failure("AUTH_REQUIRED", "请先在同一 Chrome 中登录工具台，再重新打开插件。");
      }
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw core.failure(response.ok ? "AUTH_REQUIRED" : "SERVER_ERROR", response.ok ? "登录已过期，请先打开工具台登录。" : "工具台暂时无法访问，请稍后重试。");
      }
      const envelope = await response.json();
      if (!response.ok || !envelope.success) throw core.failure(envelope.error?.code || "SERVER_ERROR", envelope.error?.message || "保存失败，请重试。");
      return envelope.data;
    } catch (error) {
      if (typeof error.code === "string") throw error;
      throw core.failure("NETWORK_ERROR", "连接失败或请求超时。请检查网络后重试；重试时会重新检查重复记录。");
    } finally { clearTimeout(timer); }
  }

  async function handle(message) {
    if (message.action === "CHECK") {
      await api("/api/accounts");
      return { connected: true };
    }
    const input = core.validateInput(message.input);
    if (message.action === "SAVE") {
      const { accounts } = await api("/api/accounts");
      const matches = core.findMatches(accounts, input);
      if (matches.length) return { kind: "duplicates", matches: matches.map(core.matchSummary) };
    }
    if (message.action === "UPDATE") {
      if (typeof message.id !== "string" || !/^[a-f0-9-]{36}$/i.test(message.id)) throw core.failure("INVALID_INPUT", "请选择要更新的记录。");
      const { accounts } = await api("/api/accounts");
      const existing = core.findMatches(accounts, input).find((account) => account.id === message.id);
      if (!existing) throw core.failure("STALE_MATCH", "记录已更改或删除，请重新检查后保存。");
      const account = await api(`/api/accounts/${existing.id}`, "PATCH", core.updateInput(input, existing));
      window.dispatchEvent(new Event("account-manager:changed"));
      return { kind: "saved", account: core.matchSummary(account) };
    }
    const account = await api("/api/accounts", "POST", input);
    window.dispatchEvent(new Event("account-manager:changed"));
    return { kind: "saved", account: core.matchSummary(account) };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || sender.tab || !core.isToolPage(location.href) || message?.channel !== "ACCOUNT_CAPTURE_BRIDGE" || !actions.has(message.action)) return;
    if (message.action === "PING") { sendResponse({ ok: true, data: { ready: true } }); return; }
    handle(message).then((data) => sendResponse({ ok: true, data })).catch((error) => sendResponse({ ok: false, error: { code: error.code || "SERVER_ERROR", message: error.code ? error.message : "操作失败，请重试。" } }));
    return true;
  });
})();
