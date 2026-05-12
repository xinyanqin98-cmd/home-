const uploadInput = document.querySelector("#planUpload");
const planPreview = document.querySelector("#planPreview");
const analysisCanvas = document.querySelector("#analysisCanvas");
const placeholder = document.querySelector("#placeholder");
const roomCount = document.querySelector("#roomCount");
const confidenceText = document.querySelector("#confidenceText");
const manualCount = document.querySelector("#manualCount");
const saveSampleBtn = document.querySelector("#saveSampleBtn");
const downloadBtn = document.querySelector("#downloadBtn");
const statusText = document.querySelector("#statusCard p");
const analysisList = document.querySelector("#analysisList");
const sampleList = document.querySelector("#sampleList");
const sampleBadge = document.querySelector("#sampleBadge");

const samples = [];
let currentAnalysis = null;
let currentImageDataUrl = "";

function setStatus(text) {
  statusText.textContent = text;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function getPixel(data, width, x, y) {
  const index = (y * width + x) * 4;
  return [data[index], data[index + 1], data[index + 2]];
}

function luminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function analyzePlan(image) {
  const maxSide = 760;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = analysisCanvas.getContext("2d", { willReadFrequently: true });

  analysisCanvas.width = width;
  analysisCanvas.height = height;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const wall = new Uint8Array(width * height);
  const open = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const lum = luminance(getPixel(data, width, x, y));
      wall[index] = lum < 135 ? 1 : 0;
      open[index] = lum > 180 ? 1 : 0;
    }
  }

  const regions = [];
  const queue = [];
  const minArea = Math.max(180, Math.round(width * height * 0.006));
  const maxArea = Math.round(width * height * 0.55);

  for (let start = 0; start < open.length; start += 1) {
    if (!open[start] || visited[start]) continue;

    let head = 0;
    let area = 0;
    let edgeTouches = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    queue.length = 0;
    queue.push(start);
    visited[start] = 1;

    while (head < queue.length) {
      const current = queue[head];
      head += 1;

      const x = current % width;
      const y = Math.floor(current / width);
      area += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      if (x < 3 || y < 3 || x > width - 4 || y > height - 4) {
        edgeTouches += 1;
      }

      const neighbors = [current - 1, current + 1, current - width, current + width];
      for (const next of neighbors) {
        if (next < 0 || next >= open.length || visited[next] || !open[next]) continue;
        const nx = next % width;
        const ny = Math.floor(next / width);
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
        visited[next] = 1;
        queue.push(next);
      }
    }

    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    const fillRatio = area / (boxWidth * boxHeight);
    const touchesOuterPaper = edgeTouches > Math.sqrt(area);

    if (area >= minArea && area <= maxArea && fillRatio > 0.22 && !touchesOuterPaper) {
      regions.push({ area, minX, minY, maxX, maxY, fillRatio });
    }
  }

  const merged = mergeRegions(regions);
  drawOverlay(ctx, image, width, height, merged);

  const count = merged.length;
  const confidence = count === 0 ? "低" : count <= 12 ? "中" : "低";

  return {
    count,
    confidence,
    regions: merged,
    imageSize: { width: image.naturalWidth, height: image.naturalHeight },
  };
}

function mergeRegions(regions) {
  const sorted = [...regions].sort((a, b) => b.area - a.area);
  const accepted = [];

  for (const region of sorted) {
    const duplicate = accepted.some((item) => {
      const overlapX = Math.max(0, Math.min(item.maxX, region.maxX) - Math.max(item.minX, region.minX));
      const overlapY = Math.max(0, Math.min(item.maxY, region.maxY) - Math.max(item.minY, region.minY));
      const overlap = overlapX * overlapY;
      return overlap / Math.min(item.area, region.area) > 0.45;
    });

    if (!duplicate) accepted.push(region);
  }

  return accepted.sort((a, b) => a.minY - b.minY || a.minX - b.minX);
}

function drawOverlay(ctx, image, width, height, regions) {
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  regions.forEach((region, index) => {
    const hue = (index * 47) % 360;
    ctx.fillStyle = `hsla(${hue}, 78%, 58%, 0.2)`;
    ctx.strokeStyle = `hsl(${hue}, 70%, 40%)`;
    ctx.lineWidth = 2;
    ctx.fillRect(region.minX, region.minY, region.maxX - region.minX, region.maxY - region.minY);
    ctx.strokeRect(region.minX, region.minY, region.maxX - region.minX, region.maxY - region.minY);
    ctx.fillStyle = "#17201b";
    ctx.font = "700 14px system-ui, sans-serif";
    ctx.fillText(String(index + 1), region.minX + 6, region.minY + 18);
  });
}

function renderAnalysis(file, analysis) {
  roomCount.textContent = analysis.count;
  manualCount.value = analysis.count;
  confidenceText.textContent = `可信度：${analysis.confidence}`;
  saveSampleBtn.disabled = false;

  analysisList.innerHTML = "";
  [
    `文件：${file.name}`,
    `图片尺寸：${analysis.imageSize.width} x ${analysis.imageSize.height}`,
    `疑似独立房间区域：${analysis.count} 个`,
    "请用人工修正结果校准它，保存后的样本可导出用于真正训练模型。",
  ].forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    analysisList.appendChild(li);
  });
}

function renderSamples() {
  sampleBadge.textContent = `${samples.length} 个样本`;
  downloadBtn.disabled = samples.length === 0;

  if (samples.length === 0) {
    sampleList.innerHTML = "<p>还没有样本。上传平面图并修正房间数后，点击记录。</p>";
    return;
  }

  sampleList.innerHTML = "";
  samples.slice().reverse().forEach((sample) => {
    const item = document.createElement("div");
    item.className = "sample-item";
    item.innerHTML = `
      <strong>${sample.fileName}</strong>
      <span>估算 ${sample.predictedCount}，标注 ${sample.labelCount}</span>
    `;
    sampleList.appendChild(item);
  });
}

uploadInput.addEventListener("change", async () => {
  const file = uploadInput.files?.[0];
  if (!file) return;

  setStatus("正在读取并分析平面图...");
  const reader = new FileReader();
  reader.addEventListener("load", async () => {
    currentImageDataUrl = reader.result;
    planPreview.src = currentImageDataUrl;
    planPreview.style.display = "none";
    placeholder.style.display = "none";

    const image = await loadImage(currentImageDataUrl);
    currentAnalysis = analyzePlan(image);
    renderAnalysis(file, currentAnalysis);
    setStatus("已完成初步估算，请检查并修正房间数。");
  });
  reader.readAsDataURL(file);
});

saveSampleBtn.addEventListener("click", () => {
  const file = uploadInput.files?.[0];
  if (!file || !currentAnalysis) return;

  const labelCount = clamp(Number.parseInt(manualCount.value, 10) || 0, 0, 99);
  samples.push({
    fileName: file.name,
    fileSize: file.size,
    predictedCount: currentAnalysis.count,
    labelCount,
    confidence: currentAnalysis.confidence,
    regions: currentAnalysis.regions,
    imageDataUrl: currentImageDataUrl,
    createdAt: new Date().toISOString(),
  });

  renderSamples();
  setStatus(`已记录样本：人工标注 ${labelCount} 个房间。`);
});

downloadBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(samples, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "floor-plan-room-count-samples.json";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("训练数据已导出。");
});

renderSamples();
