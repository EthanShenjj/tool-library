(() => {
  const TOOL_ORIGIN = "https://team-toolbox.vercel.app";
  const TOOL_URL = `${TOOL_ORIGIN}/tools/account-manager`;

  function failure(code, message, field) {
    return Object.assign(new Error(message), { code, ...(field ? { field } : {}) });
  }

  function validWebsite(value) {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
    } catch { return false; }
  }

  function domain(value) {
    if (!validWebsite(value)) return "";
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  }

  function isToolPage(value) {
    try {
      const url = new URL(value);
      return url.origin === TOOL_ORIGIN && ["/tools/account-manager", "/tools/account-manager/"].includes(url.pathname);
    } catch { return false; }
  }

  function validateInput(input) {
    if (!input || typeof input !== "object") throw failure("INVALID_INPUT", "请检查填写的信息。");
    const limits = { platform: 100, websiteUrl: 2000, username: 320, password: 4096, notes: 5000 };
    const result = {};
    for (const [field, limit] of Object.entries(limits)) {
      const value = field === "password" && input[field] === undefined ? "" : input[field];
      if (typeof value !== "string") throw failure("INVALID_INPUT", "请检查填写的信息。");
      result[field] = field === "password" ? value : value.trim();
      if (result[field].length > limit) throw failure("INVALID_INPUT", "填写内容过长，请缩短后保存。", field);
    }
    if (!result.platform) throw failure("INVALID_INPUT", "请填写平台名称。", "platform");
    if (!validWebsite(result.websiteUrl)) throw failure("INVALID_INPUT", "请填写完整的 http:// 或 https:// 网站地址，且不要在网址中包含账号密码。", "websiteUrl");
    return result;
  }

  function findMatches(accounts, input) {
    const host = domain(input.websiteUrl);
    return accounts.filter((account) => host && domain(account.websiteUrl) === host && account.username.trim() === input.username.trim());
  }

  function matchSummary(account) {
    return { id: account.id, platform: account.platform, websiteUrl: account.websiteUrl, username: account.username, hasPassword: account.hasPassword };
  }

  function updateInput(input, existing) {
    const result = { ...input, notes: input.notes || existing.notes };
    if (!result.password) delete result.password;
    return result;
  }

  const recognizePlatform = globalThis.AccountPlatforms.recognizePlatform;
  globalThis.AccountCapture = Object.freeze({ recognizePlatform, TOOL_ORIGIN, TOOL_URL, failure, validWebsite, domain, isToolPage, validateInput, findMatches, matchSummary, updateInput });
})();
