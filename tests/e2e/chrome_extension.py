"""Load the packaged extension in an isolated, real Chrome for Testing profile.

Run build:extension and start the current application with a configured test
database first. HTTP requests for the extension's fixed production origin are
proxied to --base-url; Vercel login redirects are simulated, never bypassed on
the production site. Only synthetic records created by this run are deleted.
"""
import argparse
import base64
import faulthandler
import json
import os
import tempfile
import time
import uuid
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright, expect


class ExtensionPopup:
    def __init__(self, context, source, extension_id):
        self.context = context
        self.source = source
        self.cdp = context.browser.new_browser_cdp_session()
        targets = self.cdp.send("Target.getTargets", {"filter": [{}]})["targetInfos"]
        tab_id = next(target["targetId"] for target in targets if target["type"] == "tab" and target["url"] == source.url)
        self.cdp.send("Extensions.triggerAction", {"id": extension_id, "targetId": tab_id})
        self.target = None
        deadline = time.monotonic() + 15
        while self.target is None and time.monotonic() < deadline:
            targets = self.cdp.send("Target.getTargets")["targetInfos"]
            self.target = next((target["targetId"] for target in targets if target["url"] == f"chrome-extension://{extension_id}/popup.html"), None)
            if self.target is None:
                source.wait_for_timeout(30)
        assert self.target, "Chrome did not open the extension popup"
        self.session = self.cdp.send("Target.attachToTarget", {"targetId": self.target, "flatten": False})["sessionId"]
        self.responses = {}
        self.sequence = 0
        self.cdp.on("Target.receivedMessageFromTarget", self.receive)

    def receive(self, event):
        if event["sessionId"] == self.session:
            message = json.loads(event["message"])
            if "id" in message:
                self.responses[message["id"]] = message

    def command(self, method, params=None):
        self.sequence += 1
        request_id = self.sequence
        self.cdp.send("Target.sendMessageToTarget", {"sessionId": self.session, "message": json.dumps({"id": request_id, "method": method, "params": params or {}})})
        deadline = time.monotonic() + 45
        while request_id not in self.responses and time.monotonic() < deadline:
            self.source.wait_for_timeout(20)
        assert request_id in self.responses, f"Popup command timed out: {method}"
        response = self.responses.pop(request_id)
        assert "error" not in response, f"Popup command failed: {method}"
        return response["result"]

    def evaluate(self, expression):
        result = self.command("Runtime.evaluate", {"expression": expression, "awaitPromise": True, "returnByValue": True})
        if "exceptionDetails" in result:
            detail = result["exceptionDetails"]
            print("Popup exception:", detail.get("exception", {}).get("description", detail.get("text")), flush=True)
        assert "exceptionDetails" not in result, "Popup JavaScript threw an exception"
        return result["result"].get("value")

    def wait(self, condition):
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if self.evaluate(f"document.readyState!=='loading' && Boolean({condition})"):
                return
            self.source.wait_for_timeout(60)
        detail = self.evaluate("({connection:document.querySelector('#connection-status')?.textContent,error:document.querySelector('#error')?.textContent,url:document.querySelector('#websiteUrl')?.value,valid:document.querySelector('form')?.checkValidity(),button:document.querySelector('#save')?.textContent})")
        raise AssertionError(f"Popup state timeout: {detail}")

    def fill(self, field, value):
        self.evaluate(f"(()=>{{const input=document.getElementById({json.dumps(field)});input.value={json.dumps(value)};input.dispatchEvent(new Event('input',{{bubbles:true}}));}})()")

    def click(self, button):
        self.evaluate(f"document.getElementById({json.dumps(button)}).click()")

    def value(self, field):
        return self.evaluate(f"document.getElementById({json.dumps(field)}).value")

    def connected(self):
        self.wait("document.querySelector('#connection-status')?.textContent==='已连接团队工具台'")

    def saved(self):
        self.wait("!document.querySelector('#success').hidden")

    def duplicates(self):
        self.wait("!document.querySelector('#duplicates').hidden && !document.querySelector('#update').disabled")

    def screenshot(self, path):
        data = self.command("Page.captureScreenshot", {"format": "png"})["data"]
        Path(path).write_bytes(base64.b64decode(data))

    def close(self):
        try:
            self.cdp.send("Target.closeTarget", {"targetId": self.target})
        except Exception:
            pass
        self.cdp.detach()


def run(args):
    root = Path(__file__).resolve().parents[2]
    extension = root / ".vercel/account-manager-extension"
    assert (extension / "manifest.json").exists(), "Run npm run build:extension first"
    origin = "https://team-toolbox.vercel.app"
    base = args.base_url.rstrip("/")
    prefix = f"Chrome插件验证-{uuid.uuid4().hex[:8]}"
    host = f"capture-{uuid.uuid4().hex[:8]}.example.invalid"
    source_url = f"https://{host}/login?q=keep#section"
    account_ids = set()
    flags = {"authenticated": False, "fail_create": False}

    with tempfile.TemporaryDirectory(prefix="account-extension-profile-") as profile:
        with sync_playwright() as playwright:
            http = playwright.request.new_context()
            options = {"headless": True, "args": [f"--disable-extensions-except={extension}", f"--load-extension={extension}", "--enable-unsafe-extension-debugging"], "viewport": {"width": 1280, "height": 900}}
            if args.chrome_executable:
                options["executable_path"] = args.chrome_executable
            else:
                options["channel"] = "chromium"
            context = playwright.chromium.launch_persistent_context(profile, **options)
            print("Chrome extension test profile ready.", flush=True)
            popup = None

            def proxy(route):
                parsed = urlsplit(route.request.url)
                path = parsed.path + (f"?{parsed.query}" if parsed.query else "")
                if os.environ.get("EXTENSION_TEST_DEBUG") and parsed.path == "/tools/account-manager":
                    print("Tool document request:", "authenticated" if flags["authenticated"] else "login required", flush=True)
                if not flags["authenticated"] and (parsed.path == "/tools/account-manager" or parsed.path.startswith("/api/accounts")):
                    if os.environ.get("EXTENSION_TEST_DEBUG"):
                        print("Simulated login redirect:", route.request.method, parsed.path, flush=True)
                    route.fulfill(status=302, headers={"location": "https://vercel.com/login?extension-test=1"})
                    return
                if flags["fail_create"] and parsed.path == "/api/accounts" and route.request.method == "POST":
                    route.abort("failed")
                    return
                headers = {key: value for key, value in route.request.headers.items() if key.lower() not in {"host", "content-length", "cookie"}}
                if "origin" in headers:
                    assert headers["origin"] == origin, "Bridge request was not same-origin"
                    headers["origin"] = base
                response = http.fetch(base + path, method=route.request.method, headers=headers, data=route.request.post_data_buffer, timeout=45000)
                body = response.body()
                if os.environ.get("EXTENSION_TEST_DEBUG") and parsed.path == "/tools/account-manager":
                    print("Tool document response:", response.status, flush=True)
                if os.environ.get("EXTENSION_TEST_DEBUG") and parsed.path.startswith("/api/accounts"):
                    print("Bridge HTTP:", route.request.method, parsed.path, response.status, flush=True)
                if parsed.path == "/api/accounts" and route.request.method == "POST" and response.status == 201:
                    record = json.loads(body)["data"]
                    if record["platform"].startswith(prefix) or record["username"].startswith(prefix):
                        account_ids.add(record["id"])
                response_headers = {key: value for key, value in response.headers.items() if key.lower() not in {"content-length", "content-encoding", "transfer-encoding"}}
                route.fulfill(status=response.status, headers=response_headers, body=body)

            context.route(origin + "/**", proxy)
            context.route("https://vercel.com/login**", lambda route: route.fulfill(status=200, content_type="text/html", body="<h1>Test login required</h1>"))
            context.route(f"https://{host}/**", lambda route: route.fulfill(status=200, content_type="text/html", body="<title>Capture source</title><h1>Extension test source</h1>"))
            context.route("https://github.com/**", lambda route: route.fulfill(status=200, content_type="text/html", body="<h1>Synthetic GitHub page</h1>"))
            worker = context.service_workers[0] if context.service_workers else context.wait_for_event("serviceworker")
            extension_id = worker.url.split("/")[2]
            source = context.new_page()

            def records():
                response = http.get(base + "/api/accounts")
                assert response.status == 200, "Account API unavailable"
                payload = response.json()
                assert payload["success"], "Account API returned an error"
                return [record for record in payload["data"]["accounts"] if record["platform"].startswith(prefix) or record["username"].startswith(prefix)]

            def open_popup():
                source.bring_to_front()
                return ExtensionPopup(context, source, extension_id)

            def check_password(record_id, expected):
                response = http.post(base + f"/api/accounts/{record_id}/password", headers={"origin": base})
                assert response.status == 200 and response.json()["data"]["password"] == expected, "Saved password did not match"

            try:
                source.goto(source_url)
                print("Synthetic source page ready.", flush=True)
                popup = open_popup()
                print("Toolbar popup attached.", flush=True)
                popup.wait("!document.querySelector('#login').hidden")
                if popup.value("websiteUrl") != source_url:
                    print("Capture diagnostic:", {"captured": popup.value("websiteUrl"), "expected": source_url, "activeTabs": worker.evaluate("chrome.tabs.query({active:true})"), "focusedTabs": worker.evaluate("chrome.tabs.query({active:true,lastFocusedWindow:true})"), "windows": worker.evaluate("chrome.windows.getAll()")}, flush=True)
                assert popup.value("websiteUrl") == source_url, "activeTab did not capture the complete URL"
                assert popup.value("platform") == host
                assert popup.evaluate("document.querySelector('#save').disabled")
                popup.close()
                popup = None
                print("PASS: real toolbar click grants activeTab; first login is required.", flush=True)

                flags["authenticated"] = True
                tool = next(page for page in context.pages if "vercel.com/login" in page.url)
                tool.goto(origin + "/tools/account-manager")
                print("Authenticated tool document loaded.", flush=True)
                tool.wait_for_load_state("networkidle")
                popup = open_popup()
                popup.connected()
                popup.fill("platform", prefix)
                assert popup.evaluate("innerHeight>=450"), "Chrome popup collapsed during automatic sizing"
                assert popup.evaluate("['platform','websiteUrl','username','password'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.top>=document.querySelector('#editor').getBoundingClientRect().top&&r.bottom<=document.querySelector('#actions').getBoundingClientRect().top})"), "Default fields require scrolling"
                assert popup.evaluate("(()=>{const r=document.querySelector('#save').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()"), "Save action is outside the popup viewport"
                popup.click("save")
                popup.saved()
                assert len(records()) == 1 and records()[0]["username"] == ""
                assert not records()[0]["hasPassword"]
                print("PASS: URL-only record saves through the isolated content bridge.", flush=True)

                popup.click("continue")
                assert popup.value("username") == "" and popup.value("notes") == ""
                assert popup.value("websiteUrl") == source_url
                popup.fill("username", "account-only")
                popup.evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true}))")
                popup.saved()
                assert any(record["username"] == "account-only" and not record["hasPassword"] for record in records())

                popup.fill("username", "")
                popup.fill("password", "synthetic-password-only")
                popup.click("save")
                popup.duplicates()
                popup.click("create")
                popup.saved()
                assert len([record for record in records() if record["username"] == ""]) == 2
                print("PASS: optional credentials and explicit save-another choice.", flush=True)

                popup.fill("username", "complete-account")
                popup.fill("password", "synthetic-complete-password")
                popup.evaluate("document.querySelector('#notes-section summary').click()")
                popup.fill("notes", "保留的测试备注")
                assert popup.evaluate("(()=>{const r=document.querySelector('#save').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()"), "Expanded notes hid the save action"
                popup.click("save")
                popup.saved()
                full = next(record for record in records() if record["username"] == "complete-account")
                check_password(full["id"], "synthetic-complete-password")
                assert popup.value("password") == "", "Popup retained password after successful save"
                popup.fill("notes", "")
                popup.click("save")
                popup.duplicates()
                popup.click("update")
                popup.saved()
                check_password(full["id"], "synthetic-complete-password")
                assert next(record for record in records() if record["id"] == full["id"])["notes"] == "保留的测试备注"
                print("PASS: complete records and blank-update password/note preservation.", flush=True)

                popup.fill("username", "")
                popup.click("save")
                popup.duplicates()
                assert popup.evaluate("document.querySelector('#match').options.length") == 2
                password_only = next(record for record in records() if not record["username"] and record["hasPassword"])
                popup.evaluate(f"document.querySelector('#match').value={json.dumps(password_only['id'])}")
                popup.fill("notes", "")
                assert popup.value("match") == password_only["id"], "Editing notes lost the selected duplicate"
                popup.click("update")
                popup.saved()
                check_password(password_only["id"], "synthetic-password-only")
                print("PASS: multiple matching records can be selected without clearing passwords.", flush=True)

                flags["fail_create"] = True
                popup.fill("username", "network-retry")
                popup.fill("password", "synthetic-retry-password")
                popup.click("save")
                popup.wait("!document.querySelector('#error').hidden && !document.querySelector('#save').disabled")
                assert popup.value("password") == "synthetic-retry-password"
                flags["fail_create"] = False
                popup.click("save")
                popup.saved()
                assert len([record for record in records() if record["username"] == "network-retry"]) == 1
                print("PASS: failed saves retain input and can be retried safely.", flush=True)

                flags["authenticated"] = False
                popup.fill("username", "expired-login")
                popup.fill("password", "synthetic-expiry-password")
                popup.click("save")
                popup.wait("!document.querySelector('#login').hidden")
                assert popup.value("password") == "synthetic-expiry-password"
                flags["authenticated"] = True
                popup.click("retry")
                popup.connected()
                assert popup.value("username") == "expired-login"
                print("PASS: an expired session prompts for login without losing current input.", flush=True)
                popup.click("open-manager")
                popup.close()
                popup = None

                tool.bring_to_front()
                if os.environ.get("EXTENSION_TEST_DEBUG"):
                    print("Tool focus state:", tool.evaluate("({visibility:document.visibilityState,focus:document.hasFocus(),hydrated:Object.keys(document.querySelector('main')||{}).some(key=>key.startsWith('__reactProps'))})"), flush=True)
                expect(tool.get_by_role("heading", name=prefix, exact=True).first).to_be_visible()
                tool.get_by_role("button", name="添加账号", exact=True).click()
                tool.get_by_label("平台名称").fill("未提交草稿")
                popup = open_popup()
                popup.connected()
                popup.fill("platform", prefix)
                popup.fill("username", "refresh-check")
                popup.click("save")
                popup.saved()
                popup.close()
                popup = None
                tool.bring_to_front()
                expect(tool.get_by_label("平台名称")).to_have_value("未提交草稿")
                tool.get_by_role("button", name="取消", exact=True).click()
                expect(tool.get_by_text("refresh-check", exact=True)).to_be_visible()
                print("PASS: focusing the tool refreshes the list and preserves open editor drafts.", flush=True)

                source.goto("https://github.com/login?extension-recognition-test=1#section")
                popup = open_popup()
                popup.connected()
                assert popup.value("platform") == "GitHub"
                assert popup.evaluate("document.querySelector('#platform-recognition').textContent==='识别为 GitHub · 开发工具'")
                popup.fill("username", prefix + "-auto-platform")
                popup.click("save")
                popup.saved()
                assert next(record for record in records() if record["username"] == prefix + "-auto-platform")["platform"] == "GitHub"
                popup.fill("websiteUrl", "https://creator.xiaohongshu.com/login")
                assert popup.value("platform") == "小红书"
                popup.fill("platform", prefix)
                popup.fill("username", "recognized-platform")
                popup.click("save")
                popup.saved()
                popup.close()
                popup = None
                tool.bring_to_front()
                tool.get_by_role("combobox", name="按用途分类筛选").select_option("social")
                expect(tool.get_by_text("recognized-platform", exact=True)).to_be_visible()
                expect(tool.get_by_text("小红书 · 社交内容", exact=True)).to_be_visible()
                tool.get_by_role("combobox", name="按用途分类筛选").select_option("development")
                expect(tool.get_by_text("recognized-platform", exact=True)).to_have_count(0)
                tool.get_by_role("combobox", name="按用途分类筛选").select_option("")
                print("PASS: URL recognition suggests names, preserves custom names, and saved records can be filtered by purpose.", flush=True)

                source.goto("chrome://extensions")
                popup = open_popup()
                popup.connected()
                assert popup.value("websiteUrl") == ""
                assert popup.evaluate("document.querySelector('#url-hint').textContent.includes('手动填写')")
                popup.fill("platform", "示例平台")
                popup.fill("websiteUrl", "https://github.com/login")
                popup.fill("username", "demo@example.com")
                popup.screenshot(args.screenshot)
                print("PASS: restricted pages allow manual entry; captured real extension popup screenshot.", flush=True)
            finally:
                if popup:
                    popup.close()
                for record_id in account_ids:
                    result = http.delete(base + f"/api/accounts/{record_id}", headers={"origin": base})
                    assert result.status in (200, 404), "Could not clean up a synthetic test record"
                assert not records(), "Synthetic records remain after test cleanup"
                context.close()
                http.dispose()
                print("PASS: all synthetic records and temporary browser profile cleaned up.", flush=True)


if __name__ == "__main__":
    if os.environ.get("EXTENSION_TEST_DEBUG"):
        faulthandler.dump_traceback_later(60, repeat=True)
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:3211")
    parser.add_argument("--chrome-executable", default=os.environ.get("CHROME_EXECUTABLE"))
    parser.add_argument("--screenshot", default="/private/tmp/account-manager-extension-popup.png")
    run(parser.parse_args())
