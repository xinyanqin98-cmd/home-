const uploadInput = document.querySelector("#planUpload");
const planPreview = document.querySelector("#planPreview");
const placeholder = document.querySelector("#placeholder");
const styleInput = document.querySelector("#styleInput");
const generateBtn = document.querySelector("#generateBtn");
const statusCard = document.querySelector("#statusCard p");
const constraintList = document.querySelector("#constraintList");
const layoutSummary = document.querySelector("#layoutSummary");
const roomGrid = document.querySelector("#roomGrid");
const schemeMeta = document.querySelector("#schemeMeta");
const template = document.querySelector("#roomCardTemplate");

const detectedRooms = [
  {
    key: "kitchen",
    name: "Kitchen",
    zhName: "厨房",
    role: "烹饪与备餐区",
    layout:
      "保留平面图中厨房的原始边界、入口和与 Dining 的相邻关系，橱柜沿既有墙体展开，水槽、灶台和冰箱按顺手的三角动线组织。",
    material:
      "耐污台面、易清洁墙面、哑光柜门和一处强调材质，避免为了风格效果改变厨房开口和墙体。",
    lighting:
      "顶面均匀照明加吊柜下方操作灯，台面、炉灶和水槽区域都保持清晰照度。",
    renderBrief:
      "以原厨房开间为约束的真实室内视角，展示橱柜、台面、操作灯和材质氛围。",
  },
  {
    key: "dining",
    name: "Dining",
    zhName: "餐厅",
    role: "用餐与过渡区",
    layout:
      "Dining 保持在 Kitchen、Family 和 Lounge 之间的原始连接位置，餐桌居中或微靠墙布置，四周留出通行宽度。",
    material:
      "餐桌椅、餐边柜和墙面材质与整体风格统一，餐边收纳不侵占主要动线。",
    lighting:
      "餐桌上方设置低眩光吊灯或线性灯，周边用柔和辅助光衔接公共区。",
    renderBrief:
      "从餐桌看向相邻公共空间的真实感视角，突出餐桌、吊灯、餐边柜和开放动线。",
  },
  {
    key: "family",
    name: "Family",
    zhName: "家庭厅",
    role: "日常活动区",
    layout:
      "Family 作为一楼主要日常活动空间，不新增卧室或儿童房；沙发、电视墙和活动区按现有墙面与开口关系布置。",
    material:
      "耐用地面、温和墙面、可收纳柜体和舒适软装，适合高频使用和家庭互动。",
    lighting:
      "基础照明、局部阅读光和氛围灯带分层，满足看电视、聊天和日常活动。",
    renderBrief:
      "真实家庭厅渲染视角，包含沙发、电视墙、地毯、边几和公共活动氛围。",
  },
  {
    key: "lounge",
    name: "Lounge",
    zhName: "会客休闲区",
    role: "休闲与接待区",
    layout:
      "Lounge 保留原平面图里的独立公共休闲属性，家具围合但不封堵与 Dining、Family 的关系。",
    material:
      "更有质感的单椅、矮几、装饰柜和墙面细节，用软装表达风格，不改变空间轮廓。",
    lighting:
      "落地灯、壁灯或洗墙灯营造低照度氛围，和 Family 的明亮日常光形成层次。",
    renderBrief:
      "偏会客休闲的真实感渲染视角，展示单椅、矮几、装饰灯和舒适材质。",
  },
];

const palettes = {
  cream: {
    wall: "#efe7dc",
    floor: "#c8a77b",
    furniture: "#f7f0e6",
    accent: "#9b735f",
    dark: "#3a332d",
  },
  wood: {
    wall: "#e8e2d6",
    floor: "#9d6f47",
    furniture: "#6f4f36",
    accent: "#d4b98d",
    dark: "#2f241d",
  },
  japandi: {
    wall: "#ebe9df",
    floor: "#c7b28c",
    furniture: "#ded2b7",
    accent: "#78947f",
    dark: "#33443a",
  },
  italian: {
    wall: "#dfddd8",
    floor: "#8b877f",
    furniture: "#f2f0eb",
    accent: "#1f2724",
    dark: "#151918",
  },
};

function setStatus(text) {
  statusCard.textContent = text;
}

function inferPalette(styleText) {
  const text = styleText.toLowerCase();
  if (text.includes("中古") || text.includes("胡桃")) return palettes.wood;
  if (text.includes("日式") || text.includes("原木")) return palettes.japandi;
  if (text.includes("意式") || text.includes("极简")) return palettes.italian;
  return palettes.cream;
}

function inferPlanStructure(file) {
  const sizeMb = Math.max(file.size / 1024 / 1024, 0.1).toFixed(1);
  return {
    constraints: [
      `已读取平面图：${file.name}，约 ${sizeMb}MB`,
      "当前户型按一楼公共生活层处理，只包含 Kitchen、Dining、Family、Lounge",
      "不生成主卧、儿童房、卫生间、阳台等图纸中没有出现的空间",
      "每个房间的概念渲染都保持原房间边界、墙体关系、入口关系和空间用途",
    ],
    summary:
      "已锁定为一楼四空间布局：Kitchen 负责烹饪，Dining 位于公共动线中心，Family 是日常家庭活动区，Lounge 是会客休闲区。后续方案只围绕这四个空间生成，不再扩展不存在的房间。",
  };
}

function renderConstraints(result) {
  constraintList.innerHTML = "";
  result.constraints.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    constraintList.appendChild(li);
  });
  layoutSummary.textContent = result.summary;
}

function getStyleText() {
  return styleInput.value.trim() || "现代自然风，温暖、通透、材质真实、适合一楼公共生活空间";
}

function buildPrompt(room, styleText) {
  return `根据上传的一楼平面图生成 ${room.name} (${room.zhName}) 的真实感室内概念渲染图。必须保持原始墙体、房间大小概念、开口位置、与 Kitchen / Dining / Family / Lounge 的相邻关系，不新增卧室或其他房间。风格：${styleText}。`;
}

function decorateRender(card, room) {
  card.querySelector(".room-render").classList.add(`render-${room.key}`);
  card.querySelector(".render-label").textContent = `${room.name} rendering`;
}

function renderRooms() {
  const styleText = getStyleText();
  const palette = inferPalette(styleText);
  roomGrid.innerHTML = "";

  detectedRooms.forEach((room) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.style.setProperty("--wall", palette.wall);
    card.style.setProperty("--floor", palette.floor);
    card.style.setProperty("--furniture", palette.furniture);
    card.style.setProperty("--accent", palette.accent);
    card.style.setProperty("--dark", palette.dark);
    decorateRender(card, room);
    card.querySelector("h3").textContent = `${room.name} · ${room.zhName}`;
    card.querySelector("p").textContent = `${room.role}采用「${styleText}」。这是基于原平面图的室内概念渲染方向，只改变家具、材质、灯光和软装，不改变空间结构。`;
    card.querySelector('[data-field="layout"]').textContent = room.layout;
    card.querySelector('[data-field="material"]').textContent = room.material;
    card.querySelector('[data-field="lighting"]').textContent = room.lighting;
    card.querySelector('[data-field="prompt"]').textContent = buildPrompt(room, styleText);
    card.querySelector('[data-field="renderBrief"]').textContent = room.renderBrief;
    roomGrid.appendChild(card);
  });

  schemeMeta.textContent = "4 个一楼空间已生成";
}

function renderEmptyState() {
  roomGrid.innerHTML =
    '<div class="empty-state">上传一楼平面图并输入风格后，这里会生成 Kitchen、Dining、Family、Lounge 的实景概念渲染和设计说明。</div>';
}

uploadInput.addEventListener("change", () => {
  const file = uploadInput.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    planPreview.src = reader.result;
    planPreview.style.display = "block";
    placeholder.style.display = "none";
    renderConstraints(inferPlanStructure(file));
    setStatus("已识别一楼四空间，可输入风格生成渲染方案");
  });
  reader.readAsDataURL(file);
});

document.querySelectorAll("[data-style]").forEach((button) => {
  button.addEventListener("click", () => {
    styleInput.value = button.dataset.style;
    setStatus("已选择风格，准备生成一楼四空间方案");
  });
});

generateBtn.addEventListener("click", () => {
  if (!uploadInput.files?.[0]) {
    setStatus("请先上传一楼平面图");
    return;
  }
  setStatus("正在生成 Kitchen、Dining、Family、Lounge 的渲染方案");
  window.setTimeout(() => {
    renderRooms();
    setStatus("一楼四空间概念渲染已生成");
  }, 350);
});

renderEmptyState();
