(() => {
  "use strict";

  const MAX_IMAGES = 20;
  const MAX_BYTES = 100 * 1024 * 1024;
  const MAX_PIXELS = 40 * 1000 * 1000;
  const PREVIEW_MAX_EDGE = 1600;
  const NO_WATERMARK_MESSAGE = "还没有可绘制的水印：请开启文字水印并填写内容，或添加并勾选 Logo。";
  const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
  const byId = (id) => document.getElementById(id);

  const elements = {
    imageInput: byId("imageInput"),
    addImagesButton: byId("addImagesButton"),
    emptyAddButton: byId("emptyAddButton"),
    addMoreButton: byId("addMoreButton"),
    imageCount: byId("imageCount"),
    imageList: byId("imageList"),
    listEmpty: byId("listEmpty"),
    batchSize: byId("batchSize"),
    selectedName: byId("selectedName"),
    selectedSize: byId("selectedSize"),
    emptyState: byId("emptyState"),
    canvasWrap: byId("canvasWrap"),
    previewCanvas: byId("previewCanvas"),
    dropTarget: byId("dropTarget"),
    liveMessage: byId("liveMessage"),
    resetButton: byId("resetButton"),
    exportAllButton: byId("exportAllButton"),
    exportAllLabel: byId("exportAllLabel"),
    exportButton: byId("exportButton"),
    exportLabel: byId("exportLabel"),
    selectAllToggle: byId("selectAllToggle"),
    selectionCount: byId("selectionCount"),
    previousImageButton: byId("previousImageButton"),
    nextImageButton: byId("nextImageButton"),
    previewIndex: byId("previewIndex"),
    zoomOutButton: byId("zoomOutButton"),
    zoomInButton: byId("zoomInButton"),
    zoomOutput: byId("zoomOutput"),
    fitButton: byId("fitButton"),
    actualSizeButton: byId("actualSizeButton"),
    textEnabled: byId("textEnabled"),
    textControls: byId("textControls"),
    watermarkText: byId("watermarkText"),
    textColor: byId("textColor"),
    textSize: byId("textSize"),
    textSizeOutput: byId("textSizeOutput"),
    logoEnabled: byId("logoEnabled"),
    logoControls: byId("logoControls"),
    logoInput: byId("logoInput"),
    logoButton: byId("logoButton"),
    logoPreview: byId("logoPreview"),
    logoName: byId("logoName"),
    logoSize: byId("logoSize"),
    logoSizeOutput: byId("logoSizeOutput"),
    arrangementTabs: byId("arrangementTabs"),
    singlePlacementControls: byId("singlePlacementControls"),
    patternControls: byId("patternControls"),
    positionGrid: byId("positionGrid"),
    density: byId("density"),
    densityOutput: byId("densityOutput"),
    patternSummary: byId("patternSummary"),
    angle: byId("angle"),
    angleOutput: byId("angleOutput"),
    margin: byId("margin"),
    marginOutput: byId("marginOutput"),
    opacity: byId("opacity"),
    opacityOutput: byId("opacityOutput"),
  };

  const state = {
    images: [],
    selectedId: null,
    position: "bottom-right",
    arrangement: "single",
    exporting: false,
    previewToken: 0,
    previewImage: null,
    previewImageId: null,
    zoom: 1,
    fitZoom: 1,
    zoomMode: "fit",
    logo: { file: null, url: null, image: null, width: 0, height: 0 },
  };

  function makeId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function formatBytes(bytes) {
    if (!bytes) return "0 MB";
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
  }

  function extensionOf(name) {
    const match = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : "";
  }

  function isSupportedFile(file) {
    return ["image/jpeg", "image/png", "image/webp"].includes(file.type) || allowedExtensions.has(extensionOf(file.name));
  }

  function acceptedImages() {
    return state.images.filter((item) => item.accepted);
  }

  function exportableImages() {
    return state.images.filter((item) => item.accepted && (item.status === "ready" || item.status === "complete"));
  }

  function selectedForExportImages() {
    return exportableImages().filter((item) => item.exportSelected);
  }

  function selectedImage() {
    return state.images.find((item) => item.id === state.selectedId && item.accepted) || null;
  }

  function previewImages() {
    return state.images.filter((item) => item.accepted && (item.status === "ready" || item.status === "complete"));
  }

  function announce(message, tone = "") {
    elements.liveMessage.textContent = message;
    elements.liveMessage.className = `live-message${tone ? ` is-${tone}` : ""}`;
  }

  function setControlState() {
    elements.textControls.classList.toggle("is-muted", !elements.textEnabled.checked);
    elements.logoControls.classList.toggle("is-muted", !elements.logoEnabled.checked);
    elements.singlePlacementControls.classList.toggle("is-hidden", state.arrangement !== "single");
    elements.patternControls.classList.toggle("is-hidden", state.arrangement === "single");
  }

  function updateRangeLabels() {
    elements.textSizeOutput.textContent = `${elements.textSize.value}%`;
    elements.logoSizeOutput.textContent = `${elements.logoSize.value}%`;
    elements.densityOutput.textContent = `${elements.density.value} 个`;
    elements.patternSummary.textContent = `每张图片添加 ${elements.density.value} 个水印`;
    elements.angleOutput.textContent = `${Number(elements.angle.value)}°`;
    elements.marginOutput.textContent = `${elements.margin.value}%`;
    elements.opacityOutput.textContent = `${elements.opacity.value}%`;
  }

  function renderList() {
    elements.imageList.replaceChildren();
    const accepted = acceptedImages();
    const ready = exportableImages();
    const selectedForExport = selectedForExportImages();
    const totalBytes = accepted.reduce((sum, item) => sum + item.file.size, 0);
    elements.imageCount.textContent = `${accepted.length} / ${MAX_IMAGES}`;
    elements.batchSize.textContent = formatBytes(totalBytes);
    elements.selectionCount.textContent = `已选 ${selectedForExport.length} / ${ready.length}`;
    elements.selectAllToggle.disabled = ready.length === 0 || state.exporting;
    elements.selectAllToggle.checked = ready.length > 0 && selectedForExport.length === ready.length;
    elements.selectAllToggle.indeterminate = selectedForExport.length > 0 && selectedForExport.length < ready.length;
    elements.exportAllButton.disabled = ready.length === 0 || state.exporting;
    elements.exportButton.disabled = selectedForExport.length === 0 || state.exporting;
    elements.resetButton.disabled = state.exporting;
    elements.addImagesButton.disabled = state.exporting;
    elements.addMoreButton.disabled = state.exporting;
    elements.emptyAddButton.disabled = state.exporting;
    elements.exportAllLabel.textContent = state.exporting ? "正在处理…" : ready.length ? `全部导出 ${ready.length} 张` : "全部导出";
    elements.exportLabel.textContent = state.exporting ? "正在处理…" : selectedForExport.length ? `导出选中 ${selectedForExport.length} 张` : "导出选中";

    if (!state.images.length) {
      const empty = document.createElement("div");
      empty.className = "list-empty";
      empty.innerHTML = "<span>还没有图片</span><small>导入后可在这里切换预览和逐张保存</small>";
      elements.imageList.append(empty);
      return;
    }

    state.images.forEach((item) => {
      const card = document.createElement("div");
      card.className = `image-card${item.id === state.selectedId ? " is-selected" : ""}${item.status === "error" ? " is-error" : ""}`;
      card.tabIndex = item.accepted ? 0 : -1;
      card.setAttribute("role", item.accepted ? "button" : "group");
      if (item.accepted) card.setAttribute("aria-label", `预览 ${item.file.name}`);

      const exportCheck = document.createElement("label");
      exportCheck.className = "export-check";
      exportCheck.title = item.accepted ? "勾选后可批量导出" : "此图片不可导出";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = Boolean(item.exportSelected);
      checkbox.disabled = !item.accepted || !["ready", "complete"].includes(item.status) || state.exporting;
      checkbox.setAttribute("aria-label", `选择导出 ${item.file.name}`);
      const checkmark = document.createElement("span");
      checkmark.setAttribute("aria-hidden", "true");
      exportCheck.append(checkbox, checkmark);
      exportCheck.addEventListener("click", (event) => event.stopPropagation());
      checkbox.addEventListener("change", () => {
        item.exportSelected = checkbox.checked;
        renderList();
        announce(checkbox.checked ? `已选择导出 ${item.file.name}` : `已取消导出 ${item.file.name}`);
      });

      const thumb = document.createElement("div");
      thumb.className = "thumb";
      if (item.url) {
        const image = document.createElement("img");
        image.src = item.url;
        image.alt = "";
        thumb.append(image);
      } else {
        thumb.textContent = "无法读取";
      }

      const metadata = document.createElement("div");
      metadata.className = "image-meta";
      const name = document.createElement("strong");
      name.textContent = item.file.name;
      const detail = document.createElement("span");
      if (item.status === "error") {
        detail.className = "status-error";
        detail.textContent = item.error;
      } else if (item.status === "processing") {
        detail.textContent = "正在生成水印…";
      } else {
        const dimensions = item.width ? `${item.width} × ${item.height}` : "正在读取…";
        const status = item.status === "complete" ? " · 已导出" : "";
        detail.textContent = `${dimensions} · ${formatBytes(item.file.size)}${status}`;
      }
      metadata.append(name, detail);

      const actions = document.createElement("div");
      actions.className = "card-actions";
      const save = document.createElement("button");
      save.className = "mini-action";
      save.type = "button";
      save.textContent = "↓";
      save.title = "单独保存";
      save.setAttribute("aria-label", `单独保存 ${item.file.name}`);
      save.disabled = !item.accepted || !["ready", "complete"].includes(item.status) || state.exporting;
      save.addEventListener("click", (event) => {
        event.stopPropagation();
        exportSingle(item);
      });
      const remove = document.createElement("button");
      remove.className = "mini-action";
      remove.type = "button";
      remove.textContent = "×";
      remove.title = "移除";
      remove.setAttribute("aria-label", `移除 ${item.file.name}`);
      remove.disabled = state.exporting;
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        removeImage(item.id);
      });
      actions.append(save, remove);

      card.append(exportCheck, thumb, metadata, actions);
      if (item.accepted) {
        const select = () => selectImage(item.id);
        card.addEventListener("click", select);
        card.addEventListener("keydown", (event) => {
          if (event.target !== card) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            select();
          }
        });
      }
      elements.imageList.append(card);
    });
  }

  function createErrorRecord(file, error) {
    state.images.push({ id: makeId(), file, url: null, width: 0, height: 0, status: "error", accepted: false, exportSelected: false, error });
  }

  function probeImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("图片文件已损坏或浏览器无法解码"));
      image.src = url;
    });
  }

  async function addFiles(fileList) {
    if (state.exporting) {
      announce("正在导出，请等待完成后再添加图片。", "error");
      return;
    }
    const files = Array.from(fileList || []);
    if (!files.length) return;
    let acceptedCount = acceptedImages().length;
    let acceptedBytes = acceptedImages().reduce((sum, item) => sum + item.file.size, 0);
    let rejected = 0;

    for (const file of files) {
      if (!isSupportedFile(file)) {
        createErrorRecord(file, "不支持此格式，请使用 JPG、PNG 或 WebP");
        rejected += 1;
        continue;
      }
      if (acceptedCount >= MAX_IMAGES) {
        createErrorRecord(file, "已超过 20 张批量上限");
        rejected += 1;
        continue;
      }
      if (acceptedBytes + file.size > MAX_BYTES) {
        createErrorRecord(file, "加入后将超过 100 MB 总大小上限");
        rejected += 1;
        continue;
      }

      const url = URL.createObjectURL(file);
      const item = { id: makeId(), file, url, width: 0, height: 0, status: "loading", accepted: true, exportSelected: true, error: "" };
      state.images.push(item);
      acceptedCount += 1;
      acceptedBytes += file.size;
      renderList();

      try {
        const dimensions = await probeImage(url);
        if (dimensions.width * dimensions.height > MAX_PIXELS) {
          throw new Error("图片超过 4000 万像素，部分设备无法处理，请缩小后再导入");
        }
        item.width = dimensions.width;
        item.height = dimensions.height;
        item.status = "ready";
        if (!state.selectedId) state.selectedId = item.id;
      } catch (error) {
        item.status = "error";
        item.accepted = false;
        item.exportSelected = false;
        item.error = error instanceof Error ? error.message : "图片文件无法读取";
        acceptedCount -= 1;
        acceptedBytes -= file.size;
        URL.revokeObjectURL(url);
        item.url = null;
        rejected += 1;
      }
      renderList();
    }

    // Unsupported files and batch-limit failures skip the per-item render above.
    // Render once after the batch so every rejected item is visible immediately.
    renderList();
    elements.imageInput.value = "";
    if (state.selectedId) await loadSelectedPreview();
    const loaded = files.length - rejected;
    if (rejected) announce(`已添加 ${loaded} 张，${rejected} 个文件未加入；请查看右侧原因。`, "error");
    else announce(`已添加 ${loaded} 张图片，可以统一调整水印。`, "success");
  }

  function selectImage(id) {
    if (state.selectedId === id) return;
    state.selectedId = id;
    state.zoomMode = "fit";
    renderList();
    loadSelectedPreview();
  }

  function navigatePreview(direction) {
    const items = previewImages();
    if (!items.length) return;
    const currentIndex = Math.max(0, items.findIndex((item) => item.id === state.selectedId));
    const nextIndex = Math.min(items.length - 1, Math.max(0, currentIndex + direction));
    if (nextIndex !== currentIndex) selectImage(items[nextIndex].id);
  }

  function removeImage(id) {
    if (state.exporting) return;
    const index = state.images.findIndex((item) => item.id === id);
    if (index < 0) return;
    const [removed] = state.images.splice(index, 1);
    if (removed.url) URL.revokeObjectURL(removed.url);
    if (state.selectedId === id) {
      state.selectedId = exportableImages()[0]?.id || null;
      state.previewImage = null;
      state.previewImageId = null;
    }
    renderList();
    loadSelectedPreview();
    announce(`已移除 ${removed.file.name}`);
  }

  function clearAll() {
    if (state.exporting) return;
    state.images.forEach((item) => item.url && URL.revokeObjectURL(item.url));
    state.images = [];
    state.selectedId = null;
    state.previewImage = null;
    state.previewImageId = null;
    elements.previewCanvas.width = 1;
    elements.previewCanvas.height = 1;
    renderList();
    updatePreviewHeader();
    elements.canvasWrap.hidden = true;
    elements.emptyState.hidden = false;
    elements.dropTarget.classList.remove("has-image");
    announce("已清空，可以开始新的一批图片。");
  }

  function loadDrawable(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("无法读取图片"));
      image.src = url;
    });
  }

  async function loadSelectedPreview() {
    const item = selectedImage();
    updatePreviewHeader();
    if (!item || !item.url) {
      elements.canvasWrap.hidden = true;
      elements.emptyState.hidden = false;
      elements.dropTarget.classList.remove("has-image");
      updatePreviewControls();
      return;
    }
    const token = ++state.previewToken;
    try {
      const image = await loadDrawable(item.url);
      if (token !== state.previewToken || state.selectedId !== item.id) return;
      state.previewImage = image;
      state.previewImageId = item.id;
      elements.emptyState.hidden = true;
      elements.canvasWrap.hidden = false;
      elements.dropTarget.classList.add("has-image");
      updatePreviewHeader();
      drawPreview();
    } catch {
      announce(`无法预览 ${item.file.name}`, "error");
    }
  }

  function updatePreviewHeader() {
    const item = selectedImage();
    elements.selectedName.textContent = item ? item.file.name : "等待添加图片";
    if (!item) {
      elements.selectedSize.textContent = "—";
    } else {
      const dimensions = previewDimensions(item);
      elements.selectedSize.textContent = dimensions.width ? `${dimensions.width} × ${dimensions.height} px` : "正在读取…";
    }
    updatePreviewControls();
  }

  function updatePreviewControls() {
    const items = previewImages();
    const index = items.findIndex((item) => item.id === state.selectedId);
    const hasPreview = index >= 0 && state.previewImageId === state.selectedId && !elements.canvasWrap.hidden;
    elements.previewIndex.textContent = index >= 0 ? `${index + 1} / ${items.length}` : `0 / ${items.length}`;
    elements.previousImageButton.disabled = index <= 0;
    elements.nextImageButton.disabled = index < 0 || index >= items.length - 1;
    [elements.zoomOutButton, elements.zoomInButton, elements.fitButton, elements.actualSizeButton].forEach((button) => {
      button.disabled = !hasPreview;
    });
    if (!hasPreview) elements.zoomOutput.textContent = "适应";
  }

  function fitZoomForCurrentImage() {
    const item = selectedImage();
    if (!item) return 1;
    const dimensions = previewDimensions(item);
    if (!dimensions.width || !dimensions.height) return 1;
    const stageStyle = getComputedStyle(elements.dropTarget);
    const horizontalPadding = parseFloat(stageStyle.paddingLeft) + parseFloat(stageStyle.paddingRight);
    const verticalPadding = parseFloat(stageStyle.paddingTop) + parseFloat(stageStyle.paddingBottom);
    const frameSize = 20;
    const horizontalSpace = Math.max(80, elements.dropTarget.clientWidth - horizontalPadding - frameSize);
    const verticalSpace = Math.max(80, elements.dropTarget.clientHeight - verticalPadding - frameSize);
    return Math.min(1, horizontalSpace / dimensions.width, verticalSpace / dimensions.height);
  }

  function applyZoom(value = state.zoom, mode = "manual", keepCenter = false) {
    const item = selectedImage();
    if (!item || elements.canvasWrap.hidden) return;
    const dimensions = previewDimensions(item);
    if (!dimensions.width || !dimensions.height) return;
    const oldScrollWidth = elements.dropTarget.scrollWidth;
    const oldScrollHeight = elements.dropTarget.scrollHeight;
    const centerX = oldScrollWidth ? (elements.dropTarget.scrollLeft + elements.dropTarget.clientWidth / 2) / oldScrollWidth : 0.5;
    const centerY = oldScrollHeight ? (elements.dropTarget.scrollTop + elements.dropTarget.clientHeight / 2) / oldScrollHeight : 0.5;
    state.fitZoom = fitZoomForCurrentImage();
    state.zoomMode = mode;
    state.zoom = mode === "fit" ? state.fitZoom : Math.min(4, Math.max(0.1, value));
    const displayWidth = Math.max(1, Math.round(dimensions.width * state.zoom));
    const displayHeight = Math.max(1, Math.round(dimensions.height * state.zoom));
    elements.previewCanvas.style.width = `${displayWidth}px`;
    elements.previewCanvas.style.height = `${displayHeight}px`;
    elements.canvasWrap.style.width = `${displayWidth + 20}px`;
    elements.canvasWrap.style.height = `${displayHeight + 20}px`;
    elements.zoomOutput.textContent = `${Math.round(state.zoom * 100)}%`;
    elements.fitButton.classList.toggle("is-active", mode === "fit");
    elements.actualSizeButton.classList.toggle("is-active", Math.abs(state.zoom - 1) < 0.001 && mode !== "fit");
    elements.zoomOutButton.disabled = state.zoom <= 0.1001;
    elements.zoomInButton.disabled = state.zoom >= 3.999;
    if (keepCenter) {
      requestAnimationFrame(() => {
        elements.dropTarget.scrollLeft = centerX * elements.dropTarget.scrollWidth - elements.dropTarget.clientWidth / 2;
        elements.dropTarget.scrollTop = centerY * elements.dropTarget.scrollHeight - elements.dropTarget.clientHeight / 2;
      });
    }
  }

  function setZoom(value) {
    applyZoom(value, "manual", true);
  }

  function currentSettings() {
    return {
      textEnabled: elements.textEnabled.checked && elements.watermarkText.value.trim().length > 0,
      text: elements.watermarkText.value.trim(),
      textColor: elements.textColor.value,
      textSize: Number(elements.textSize.value) / 100,
      logoEnabled: elements.logoEnabled.checked && Boolean(state.logo.image),
      logoSize: Number(elements.logoSize.value) / 100,
      logo: state.logo,
      opacity: Number(elements.opacity.value) / 100,
      margin: Number(elements.margin.value) / 100,
      position: state.position,
      arrangement: state.arrangement,
      count: Number(elements.density.value),
      angle: Number(elements.angle.value),
    };
  }

  function deterministicRandom(input) {
    let seed = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      seed ^= input.charCodeAt(index);
      seed = Math.imul(seed, 16777619);
    }
    return () => {
      seed += 0x6D2B79F5;
      let value = seed;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function drawWatermarks(context, width, height, settings, item) {
    const shortest = Math.min(width, height);
    const parts = [];
    const fontSize = Math.max(12, shortest * settings.textSize);
    const font = `800 ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;

    if (settings.logoEnabled) {
      const logoWidth = width * settings.logoSize;
      const logoHeight = logoWidth * (settings.logo.height / settings.logo.width);
      parts.push({ type: "logo", width: logoWidth, height: logoHeight });
    }
    if (settings.textEnabled) {
      context.save();
      context.font = font;
      const metrics = context.measureText(settings.text);
      context.restore();
      parts.push({ type: "text", width: metrics.width, height: fontSize * 1.18 });
    }
    if (!parts.length) return;

    const gap = parts.length > 1 ? shortest * 0.018 : 0;
    const blockWidth = Math.max(...parts.map((part) => part.width));
    const blockHeight = parts.reduce((sum, part) => sum + part.height, 0) + gap * (parts.length - 1);
    const baseAngle = settings.angle * Math.PI / 180;

    const drawGroup = (centerX, centerY, angle = baseAngle, scale = 1) => {
      context.save();
      context.translate(centerX, centerY);
      context.rotate(angle);
      context.scale(scale, scale);
      context.globalAlpha = settings.opacity;
      let cursorY = -blockHeight / 2;
      parts.forEach((part) => {
        const partX = -part.width / 2;
        if (part.type === "logo") {
          context.drawImage(settings.logo.image, partX, cursorY, part.width, part.height);
        } else {
          context.font = font;
          context.textAlign = "left";
          context.textBaseline = "top";
          context.fillStyle = settings.textColor;
          context.shadowColor = "rgba(0,0,0,.48)";
          context.shadowBlur = Math.max(2, fontSize * 0.08);
          context.shadowOffsetY = Math.max(1, fontSize * 0.035);
          context.fillText(settings.text, partX, cursorY);
          context.shadowColor = "transparent";
        }
        cursorY += part.height + gap;
      });
      context.restore();
    };

    if (settings.arrangement === "single") {
      const marginX = width * settings.margin;
      const marginY = height * settings.margin;
      const rotatedWidth = Math.abs(blockWidth * Math.cos(baseAngle)) + Math.abs(blockHeight * Math.sin(baseAngle));
      const rotatedHeight = Math.abs(blockWidth * Math.sin(baseAngle)) + Math.abs(blockHeight * Math.cos(baseAngle));
      const [vertical, horizontal] = settings.position.includes("-") ? settings.position.split("-") : [settings.position, settings.position];
      let centerX = marginX + rotatedWidth / 2;
      if (horizontal === "center" || settings.position === "center") centerX = width / 2;
      if (horizontal === "right") centerX = width - marginX - rotatedWidth / 2;
      let centerY = marginY + rotatedHeight / 2;
      if (vertical === "center" || settings.position === "center") centerY = height / 2;
      if (vertical === "bottom") centerY = height - marginY - rotatedHeight / 2;
      drawGroup(centerX, centerY);
      return;
    }

    const columns = Math.max(2, Math.ceil(Math.sqrt(settings.count * width / height)));
    let rows = Math.ceil(settings.count / columns);
    // 错位行整体右移半格，行尾一格会出界，每行少放一个，补足行数保证 count 个水印都完整可见
    while (settings.arrangement === "stagger" && columns * rows - Math.floor(rows / 2) < settings.count) {
      rows += 1;
    }
    const cellWidth = width / columns;
    const cellHeight = height / rows;
    const fittedScale = Math.min(1, cellWidth / (blockWidth * 1.45), cellHeight / (blockHeight * 1.55));

    if (settings.arrangement === "random") {
      const logoKey = settings.logo.file?.name || "no-logo";
      const random = deterministicRandom(`${settings.text}|${logoKey}|${settings.count}|${settings.angle}|${item.file.name}|${item.file.size}`);
      const cells = Array.from({ length: columns * rows }, (_, index) => ({
        column: index % columns,
        row: Math.floor(index / columns),
      }));
      for (let index = cells.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [cells[index], cells[swapIndex]] = [cells[swapIndex], cells[index]];
      }
      cells.slice(0, settings.count).forEach((cell) => {
        const centerX = (cell.column + 0.5 + (random() - 0.5) * 0.46) * cellWidth;
        const centerY = (cell.row + 0.5 + (random() - 0.5) * 0.46) * cellHeight;
        const angle = baseAngle + (random() - 0.5) * (Math.PI / 6);
        const scale = fittedScale * (0.78 + random() * 0.42);
        drawGroup(centerX, centerY, angle, scale);
      });
      return;
    }

    let placed = 0;
    for (let row = 0; row < rows && placed < settings.count; row += 1) {
      const offset = settings.arrangement === "stagger" && row % 2 ? cellWidth / 2 : 0;
      const columnsInRow = columns - (offset ? 1 : 0);
      for (let column = 0; column < columnsInRow && placed < settings.count; column += 1) {
        const centerX = (column + 0.5) * cellWidth + offset;
        const centerY = (row + 0.5) * cellHeight;
        drawGroup(centerX, centerY, baseAngle, fittedScale);
        placed += 1;
      }
    }
  }

  function drawComposite(source, canvas, targetWidth, targetHeight, settings, item) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d", { alpha: true });
    context.clearRect(0, 0, targetWidth, targetHeight);
    context.drawImage(source, 0, 0, targetWidth, targetHeight);
    drawWatermarks(context, targetWidth, targetHeight, settings, item);
  }

  function previewDimensions(item) {
    if (item.width && item.height) return { width: item.width, height: item.height };
    if (state.previewImageId === item.id && state.previewImage) {
      return { width: state.previewImage.naturalWidth, height: state.previewImage.naturalHeight };
    }
    return { width: 0, height: 0 };
  }

  function drawPreview() {
    const item = selectedImage();
    if (!item || !state.previewImage || state.previewImageId !== item.id) return;
    const dimensions = previewDimensions(item);
    if (!dimensions.width || !dimensions.height) return;
    const scale = Math.min(1, PREVIEW_MAX_EDGE / Math.max(dimensions.width, dimensions.height));
    drawComposite(
      state.previewImage,
      elements.previewCanvas,
      Math.round(dimensions.width * scale),
      Math.round(dimensions.height * scale),
      currentSettings(),
      item,
    );
    requestAnimationFrame(() => {
      applyZoom(state.zoom, state.zoomMode);
      updatePreviewControls();
    });
  }

  async function chooseLogo(file) {
    if (!file) return;
    if (!isSupportedFile(file)) {
      announce("Logo 格式不支持，请选择 JPG、PNG 或 WebP。", "error");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const image = await loadDrawable(url);
      if (image.naturalWidth * image.naturalHeight > MAX_PIXELS) {
        URL.revokeObjectURL(url);
        elements.logoInput.value = "";
        announce("Logo 图片过大，请先缩小后再添加。", "error");
        return;
      }
      if (state.logo.url) URL.revokeObjectURL(state.logo.url);
      state.logo = { file, url, image, width: image.naturalWidth, height: image.naturalHeight };
      elements.logoEnabled.checked = true;
      elements.logoName.textContent = file.name;
      elements.logoPreview.replaceChildren();
      const preview = document.createElement("img");
      preview.src = url;
      preview.alt = "Logo 预览";
      elements.logoPreview.append(preview);
      setControlState();
      drawPreview();
      announce("Logo 已添加，将应用到本批次所有图片。", "success");
    } catch {
      URL.revokeObjectURL(url);
      announce("Logo 文件已损坏或无法读取。", "error");
    }
    elements.logoInput.value = "";
  }

  function outputType(item) {
    const extension = extensionOf(item.file.name);
    if (item.file.type === "image/jpeg" || extension === "jpg" || extension === "jpeg") return { mime: "image/jpeg", extension: "jpg" };
    if (item.file.type === "image/png" || extension === "png") return { mime: "image/png", extension: "png" };
    return { mime: "image/png", extension: "png" };
  }

  function outputName(item, usedNames = new Map()) {
    const format = outputType(item);
    const base = item.file.name.replace(/\.[^.]+$/, "") || "image";
    const key = `${base.toLowerCase()}.${format.extension}`;
    const number = (usedNames.get(key) || 0) + 1;
    usedNames.set(key, number);
    return `${base}-watermark${number > 1 ? `-${number}` : ""}.${format.extension}`;
  }

  function canvasToBlob(canvas, mime) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("浏览器未能生成图片文件")), mime, mime === "image/jpeg" ? 0.92 : undefined);
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function createWatermarkedBlob(item, settings) {
    if (!item.url) throw new Error("原图不可用");
    const source = await loadDrawable(item.url);
    const canvas = document.createElement("canvas");
    drawComposite(source, canvas, item.width, item.height, settings, item);
    const format = outputType(item);
    const blob = await canvasToBlob(canvas, format.mime);
    canvas.width = 1;
    canvas.height = 1;
    return blob;
  }

  async function exportSingle(item) {
    if (!item.accepted || state.exporting || item.status === "loading") return;
    const settings = currentSettings();
    if (!settings.textEnabled && !settings.logoEnabled) {
      announce(NO_WATERMARK_MESSAGE, "error");
      return;
    }
    const previousStatus = item.status;
    state.exporting = true;
    item.status = "processing";
    renderList();
    announce(`正在生成 ${item.file.name}…`);
    try {
      const blob = await createWatermarkedBlob(item, settings);
      downloadBlob(blob, outputName(item));
      item.status = "complete";
      announce(`${item.file.name} 已生成，请查看浏览器下载记录。`, "success");
    } catch (error) {
      item.status = previousStatus === "complete" ? "complete" : "ready";
      announce(error instanceof Error ? error.message : "图片导出失败", "error");
    } finally {
      state.exporting = false;
      renderList();
    }
  }

  async function exportBatch(items) {
    if (!items.length || state.exporting) return;
    if (items.length === 1) {
      await exportSingle(items[0]);
      return;
    }

    const settings = currentSettings();
    if (!settings.textEnabled && !settings.logoEnabled) {
      announce(NO_WATERMARK_MESSAGE, "error");
      return;
    }

    state.exporting = true;
    renderList();
    const zip = new JSZip();
    const usedNames = new Map();
    let completed = 0;
    let failed = 0;

    for (const item of items) {
      item.status = "processing";
      renderList();
      announce(`正在处理第 ${completed + failed + 1} / ${items.length} 张：${item.file.name}`);
      try {
        const blob = await createWatermarkedBlob(item, settings);
        zip.file(outputName(item, usedNames), blob);
        item.status = "complete";
        completed += 1;
      } catch (error) {
        item.status = "error";
        item.accepted = false;
        item.exportSelected = false;
        item.error = error instanceof Error ? error.message : "导出失败";
        failed += 1;
      }
    }

    try {
      if (!completed) throw new Error("没有图片成功生成，请检查右侧错误信息");
      announce("正在打包 ZIP，请保持页面开启…");
      const blob = await zip.generateAsync(
        { type: "blob", compression: "STORE" },
        (progress) => announce(`正在打包 ZIP：${Math.round(progress.percent)}%`),
      );
      downloadBlob(blob, `watermarked-images-${new Date().toISOString().slice(0, 10)}.zip`);
      announce(`已打包 ${completed} 张图片${failed ? `，${failed} 张失败` : ""}。`, failed ? "error" : "success");
    } catch (error) {
      announce(error instanceof Error ? error.message : "ZIP 打包失败，请尝试逐张保存", "error");
    } finally {
      state.exporting = false;
      renderList();
    }
  }

  [elements.addImagesButton, elements.emptyAddButton, elements.addMoreButton].forEach((button) => {
    button.addEventListener("click", () => elements.imageInput.click());
  });
  elements.imageInput.addEventListener("change", () => addFiles(elements.imageInput.files));
  elements.logoButton.addEventListener("click", () => elements.logoInput.click());
  elements.logoInput.addEventListener("change", () => chooseLogo(elements.logoInput.files?.[0]));
  elements.resetButton.addEventListener("click", clearAll);
  elements.exportAllButton.addEventListener("click", () => exportBatch(exportableImages()));
  elements.exportButton.addEventListener("click", () => exportBatch(selectedForExportImages()));
  elements.selectAllToggle.addEventListener("change", () => {
    exportableImages().forEach((item) => {
      item.exportSelected = elements.selectAllToggle.checked;
    });
    const count = selectedForExportImages().length;
    renderList();
    announce(count ? `已选择全部 ${count} 张可导出图片。` : "已取消全部导出选择。");
  });

  elements.previousImageButton.addEventListener("click", () => navigatePreview(-1));
  elements.nextImageButton.addEventListener("click", () => navigatePreview(1));
  elements.zoomOutButton.addEventListener("click", () => setZoom(state.zoom / 1.2));
  elements.zoomInButton.addEventListener("click", () => setZoom(state.zoom * 1.2));
  elements.fitButton.addEventListener("click", () => applyZoom(state.fitZoom, "fit", true));
  elements.actualSizeButton.addEventListener("click", () => applyZoom(1, "actual", true));

  [elements.textEnabled, elements.logoEnabled].forEach((control) => {
    control.addEventListener("change", () => {
      setControlState();
      drawPreview();
    });
  });
  [elements.watermarkText, elements.textColor, elements.textSize, elements.logoSize, elements.margin, elements.density, elements.angle, elements.opacity].forEach((control) => {
    control.addEventListener("input", () => {
      updateRangeLabels();
      drawPreview();
    });
  });

  elements.arrangementTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-arrangement]");
    if (!button) return;
    state.arrangement = button.dataset.arrangement;
    if (state.arrangement !== "single" && Number(elements.angle.value) === 0) {
      elements.angle.value = "-25";
    }
    elements.arrangementTabs.querySelectorAll("button").forEach((item) => {
      const selected = item === button;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-checked", String(selected));
    });
    setControlState();
    updateRangeLabels();
    drawPreview();
    const labels = { single: "单个", tile: "整齐平铺", stagger: "错位多排", random: "随机散布" };
    announce(`已切换为${labels[state.arrangement]}水印。`, "success");
  });

  elements.positionGrid.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-position]");
    if (!button) return;
    state.position = button.dataset.position;
    elements.positionGrid.querySelectorAll("button").forEach((item) => {
      const selected = item === button;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-checked", String(selected));
    });
    drawPreview();
  });

  let dragDepth = 0;
  window.addEventListener("dragover", (event) => event.preventDefault());
  window.addEventListener("drop", (event) => event.preventDefault());
  elements.dropTarget.addEventListener("dragenter", (event) => {
    event.preventDefault();
    dragDepth += 1;
    elements.dropTarget.classList.add("is-dragging");
  });
  elements.dropTarget.addEventListener("dragleave", () => {
    dragDepth -= 1;
    if (dragDepth <= 0) {
      dragDepth = 0;
      elements.dropTarget.classList.remove("is-dragging");
    }
  });
  elements.dropTarget.addEventListener("drop", (event) => {
    event.preventDefault();
    dragDepth = 0;
    elements.dropTarget.classList.remove("is-dragging");
    addFiles(event.dataTransfer.files);
  });

  elements.dropTarget.addEventListener("wheel", (event) => {
    if (!event.ctrlKey || !selectedImage() || elements.canvasWrap.hidden) return;
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.012);
    setZoom(state.zoom * factor);
  }, { passive: false });

  let gestureStartZoom = 1;
  elements.dropTarget.addEventListener("gesturestart", (event) => {
    if (!selectedImage() || elements.canvasWrap.hidden) return;
    event.preventDefault();
    gestureStartZoom = state.zoom;
  }, { passive: false });
  elements.dropTarget.addEventListener("gesturechange", (event) => {
    if (!selectedImage() || elements.canvasWrap.hidden) return;
    event.preventDefault();
    setZoom(gestureStartZoom * event.scale);
  }, { passive: false });

  elements.previewCanvas.addEventListener("dblclick", () => applyZoom(state.fitZoom, "fit", true));

  window.addEventListener("keydown", (event) => {
    const target = event.target;
    const isEditing = target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
    if (isEditing || event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      navigatePreview(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      navigatePreview(1);
    }
  });

  let resizeFrame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      if (state.zoomMode === "fit") applyZoom(state.fitZoom, "fit");
    });
  });

  if ("ResizeObserver" in window) {
    const stageObserver = new ResizeObserver(() => {
      if (state.zoomMode !== "fit" || elements.canvasWrap.hidden) return;
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => applyZoom(state.fitZoom, "fit"));
    });
    stageObserver.observe(elements.dropTarget);
  }

  window.addEventListener("beforeunload", () => {
    state.images.forEach((item) => item.url && URL.revokeObjectURL(item.url));
    if (state.logo.url) URL.revokeObjectURL(state.logo.url);
  });

  setControlState();
  updateRangeLabels();
  renderList();
  updatePreviewHeader();
  announce("准备就绪：添加图片后即可开始编辑。", "success");
})();
