from playwright.sync_api import sync_playwright, expect


def assert_no_console_errors(errors):
    assert not errors, "Browser console errors:\n" + "\n".join(errors)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    console_errors = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)

    page.goto("http://localhost:3000")
    page.wait_for_load_state("networkidle")
    expect(page).to_have_title("团队工具台")
    expect(page.get_by_role("heading", name="工具目录")).to_be_visible()
    expect(page.get_by_role("heading", name="Google Sheet")).to_be_visible()
    page.screenshot(path="/private/tmp/team-toolbox-home.png", full_page=True)

    page.locator('a[href="/tools/google-sheet"]').click()
    page.wait_for_load_state("networkidle")
    expect(page.get_by_role("heading", name="Google Sheet 连接器")).to_be_visible()
    expect(page.get_by_text("数据库尚未就绪。")).to_be_visible()

    page.locator('a[href="/tools/google-sheet/connectors/new"]').first.click()
    page.wait_for_load_state("networkidle")
    expect(page.get_by_role("heading", name="新建 Sheet 连接器")).to_be_visible()
    expect(page.get_by_text("这些参数仅保存配置，当前版本不会执行自动同步。")).to_be_visible()

    page.goto("http://localhost:3000/tools/image-watermark")
    page.wait_for_load_state("networkidle")
    expect(page.get_by_role("heading", name="图片只在当前设备处理")).to_be_visible()
    watermark = page.frame_locator('iframe[title="图章批量水印编辑器"]')
    expect(watermark.locator("#addImagesButton")).to_be_visible()
    watermark.locator("#imageInput").set_input_files({
        "name": "unsupported.txt",
        "mimeType": "text/plain",
        "buffer": b"not an image",
    })
    expect(watermark.locator(".status-error")).to_contain_text("不支持此格式")
    expect(watermark.locator("#imageCount")).to_have_text("0 / 20")

    page.set_viewport_size({"width": 390, "height": 844})
    page.goto("http://localhost:3000")
    page.wait_for_load_state("networkidle")
    page.screenshot(path="/private/tmp/team-toolbox-mobile.png", full_page=True)
    expect(page.get_by_role("heading", name="Google Sheet")).to_be_visible()

    assert_no_console_errors(console_errors)
    browser.close()

print("Browser smoke test passed: dashboard, tool workspace, form, and mobile layout.")
