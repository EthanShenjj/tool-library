/* global chrome */
(() => {
  const core = globalThis.AccountCapture;
  const get = (id) => document.getElementById(id);
  const state = { busy: false, connecting: false, capturing: true, opening: false, connected: false, saved: false, matches: [], capturedUrl: "", autoPlatform: "", dirty: new Set() };

  async function rpc(type, extra = {}) {
    let response;
    try { response = await chrome.runtime.sendMessage({ channel: "ACCOUNT_CAPTURE_POPUP", type, ...extra }); }
    catch { throw core.failure("CONNECTION_ERROR", "插件连接已中断，请关闭弹窗后重新打开。"); }
    if (!response?.ok) throw core.failure(response?.error?.code || "CONNECTION_ERROR", response?.error?.message || "操作失败，请重试。");
    return response.data;
  }

  function render() {
    const matches = state.matches.length > 0;
    get("fields").disabled = state.busy;
    get("account-form").setAttribute("aria-busy", String(state.busy));
    get("save").disabled = state.busy || state.capturing || !state.connected || state.saved;
    get("save").hidden = matches || state.saved;
    get("save").textContent = state.busy ? "正在检查并保存…" : state.capturing ? "正在获取网址…" : state.connecting ? "正在连接…" : !state.connected ? "连接工具台后保存" : "保存到账号管理";
    get("duplicate-actions").hidden = !matches || state.saved;
    get("update").disabled = state.busy || !state.connected;
    get("create").disabled = state.busy || !state.connected;
    get("update").textContent = state.busy ? "正在保存…" : "更新已有记录";
    get("match").disabled = state.busy;
    get("retry").disabled = state.busy || state.connecting;
    for (const id of ["login", "open-manager", "view-saved"]) get(id).disabled = state.busy || state.opening;
    get("continue").disabled = state.busy;
    get("restore-url").hidden = !state.capturedUrl || get("websiteUrl").value === state.capturedUrl;
    get("notes-indicator").hidden = !get("notes").value.trim();
    const recognition = core.recognizePlatform(get("websiteUrl").value);
    get("platform-recognition").hidden = !recognition.hostname;
    get("platform-recognition").textContent = recognition.recognized ? `识别为 ${recognition.name} · ${recognition.categoryLabel}` : "暂未识别平台 · 未分类，可手动填写名称";
    get("success-panel").hidden = !state.saved;
    get("shortcut").textContent = state.saved ? "密码已从弹窗清除" : matches ? "请选择更新或另存" : "Ctrl / ⌘ + Enter 保存";
  }

  function resetMatches() {
    state.matches = [];
    get("duplicates").hidden = true;
    get("match").replaceChildren();
  }

  function clearFieldError(id) {
    get(id).removeAttribute("aria-invalid");
    if (get(`${id}-error`)) get(`${id}-error`).hidden = true;
  }

  function showError(error) {
    get("error").textContent = error.message;
    get("error").hidden = false;
    if (error.field && get(error.field)) {
      const field = get(error.field);
      if (error.field === "notes") get("notes-section").open = true;
      field.setAttribute("aria-invalid", "true");
      if (get(`${error.field}-error`)) {
        get(`${error.field}-error`).textContent = error.message;
        get(`${error.field}-error`).hidden = false;
      }
      field.focus();
    }
    if (["AUTH_REQUIRED", "CONNECTION_ERROR"].includes(error.code)) {
      state.connected = false;
      get("connection-status").textContent = error.code === "AUTH_REQUIRED" ? "请先登录工具台" : "连接已中断";
      get("connection-dot").className = "dot offline";
      get("login").hidden = error.code !== "AUTH_REQUIRED";
      get("retry").hidden = false;
    }
    if (error.code === "STALE_MATCH") resetMatches();
    render();
  }

  function formInput() {
    for (const id of ["platform", "websiteUrl", "username", "password", "notes"]) clearFieldError(id);
    return core.validateInput(Object.fromEntries(["platform", "websiteUrl", "username", "password", "notes"].map((key) => [key, get(key).value])));
  }

  function hidePassword() {
    get("password").type = "password";
    get("toggle-password").textContent = "显示";
    get("toggle-password").setAttribute("aria-label", "显示密码");
    get("toggle-password").setAttribute("aria-pressed", "false");
  }

  function previewMatch() {
    const account = state.matches.find((item) => item.id === get("match").value);
    get("match-preview").textContent = account ? `${account.websiteUrl} · ${account.hasPassword ? "已存密码" : "未存密码"}` : "";
  }

  async function save(type = "PREPARE_SAVE") {
    if (state.busy || state.capturing || !state.connected || state.saved) return;
    if (type === "PREPARE_SAVE" && state.matches.length) {
      get("duplicates").scrollIntoView?.({ block: "nearest" });
      get("duplicate-heading").focus();
      return;
    }
    let input;
    try { input = formInput(); }
    catch (error) { showError(error); return; }
    state.busy = true;
    hidePassword();
    get("error").hidden = true;
    get("success").hidden = true;
    render();
    try {
      const result = await rpc(type, { input, ...(type === "UPDATE_ACCOUNT" ? { id: get("match").value } : {}) });
      if (result.kind === "duplicates") {
        state.matches = result.matches;
        get("match").replaceChildren(...result.matches.map((account, index) => {
          const option = document.createElement("option");
          option.value = account.id;
          option.textContent = `${index + 1}. ${account.platform} / ${account.username || "未填写账号"}`;
          return option;
        }));
        const multiple = result.matches.length > 1;
        get("duplicate-heading").textContent = multiple ? `找到 ${result.matches.length} 条重复记录` : "这个网站和账号已经保存过";
        get("match").hidden = !multiple;
        get("match-label").hidden = !multiple;
        get("duplicates").hidden = false;
        previewMatch();
      } else {
        resetMatches();
        state.saved = true;
        get("password").value = "";
        get("success").textContent = type === "UPDATE_ACCOUNT" ? "已更新到账号管理" : "已保存到账号管理";
        get("saved-summary").textContent = `${input.platform} / ${input.username || "未填写账号"}`;
        get("success").hidden = false;
      }
    } catch (error) { showError(error); }
    finally {
      state.busy = false;
      render();
      if (state.saved) get("success").focus();
      else if (state.matches.length) {
        get("duplicates").scrollIntoView?.({ block: "nearest" });
        (get("match").hidden ? get("duplicate-heading") : get("match")).focus();
      }
    }
  }

  async function connect() {
    if (state.busy || state.connecting) return;
    state.connecting = true;
    state.connected = false;
    get("connection-status").textContent = "正在连接工具台…";
    get("connection-dot").className = "dot";
    get("login").hidden = true;
    get("retry").hidden = true;
    get("error").hidden = true;
    render();
    try {
      await rpc("CHECK_CONNECTION");
      state.connected = true;
      get("connection-status").textContent = "已连接团队工具台";
      get("connection-dot").className = "dot ready";
    } catch (error) {
      get("connection-status").textContent = "暂未连接";
      get("connection-dot").className = "dot offline";
      get("retry").hidden = false;
      showError(error);
    } finally { state.connecting = false; render(); }
  }

  const open = async () => {
    if (state.busy || state.opening) return;
    state.opening = true;
    render();
    try { await rpc("OPEN_MANAGER"); }
    catch (error) { showError(error); }
    finally { state.opening = false; render(); }
  };
  for (const id of ["open-manager", "view-saved", "login"]) get(id).addEventListener("click", open);
  get("retry").addEventListener("click", connect);
  get("account-form").addEventListener("submit", (event) => { event.preventDefault(); save(); });
  get("update").addEventListener("click", () => save("UPDATE_ACCOUNT"));
  get("create").addEventListener("click", () => save("CREATE_ACCOUNT"));
  get("match").addEventListener("change", previewMatch);
  get("continue").addEventListener("click", () => {
    for (const id of ["username", "password", "notes"]) { get(id).value = ""; clearFieldError(id); }
    hidePassword();
    state.saved = false;
    get("success").hidden = true;
    get("error").hidden = true;
    get("notes-section").open = false;
    render();
    get("username").focus();
  });
  get("fields").addEventListener("input", (event) => {
    const id = event.target.id;
    state.dirty.add(id);
    clearFieldError(id);
    state.saved = false;
    if (["websiteUrl", "username"].includes(id)) resetMatches();
    if (id === "websiteUrl") {
      const platform = core.recognizePlatform(get("websiteUrl").value).name;
      if (platform && (!get("platform").value || get("platform").value === state.autoPlatform)) {
        get("platform").value = platform;
        state.autoPlatform = platform;
      }
    }
    get("error").hidden = true;
    get("success").hidden = true;
    render();
  });
  get("restore-url").addEventListener("click", () => {
    get("websiteUrl").value = state.capturedUrl;
    get("websiteUrl").dispatchEvent(new Event("input", { bubbles: true }));
    get("websiteUrl").focus();
  });
  get("toggle-password").addEventListener("click", () => {
    if (get("password").type === "text") hidePassword();
    else {
      get("password").type = "text";
      get("toggle-password").textContent = "隐藏";
      get("toggle-password").setAttribute("aria-label", "隐藏密码");
      get("toggle-password").setAttribute("aria-pressed", "true");
    }
  });
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      save();
    }
  });
  window.addEventListener("blur", hidePassword);
  window.addEventListener("pagehide", () => { get("password").value = ""; hidePassword(); });

  async function initialize() {
    try {
      const owner = await chrome.windows.getCurrent();
      const context = await rpc("CAPTURE_CONTEXT", { windowId: owner.id });
      state.capturedUrl = context.url;
      if (!state.dirty.has("websiteUrl")) get("websiteUrl").value = context.url;
      if (!state.dirty.has("platform") && !get("platform").value) {
        const name = core.recognizePlatform(get("websiteUrl").value).name || context.platform;
        get("platform").value = name;
        state.autoPlatform = name;
      }
      if (!context.url) get("url-hint").textContent = "当前页面不支持自动获取网址，请手动填写 http:// 或 https:// 地址。";
    } catch {
      get("url-hint").textContent = "未能获取当前网址，请手动填写 http:// 或 https:// 地址。";
    } finally { state.capturing = false; render(); }
    if (!state.dirty.size && document.activeElement === document.body) (get("platform").value ? get("username") : get("platform")).focus();
    await connect();
  }
  initialize();
})();
