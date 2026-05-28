const stage = document.querySelector("#previewStage");
const blockLayer = document.querySelector("#blockLayer");
const blockSelect = document.querySelector("#blockSelect");
const statusText = document.querySelector("#statusText");
const saveLayoutButton = document.querySelector("#saveLayoutButton");
const generateButton = document.querySelector("#generateButton");
const bringForwardButton = document.querySelector("#bringForwardButton");
const sendBackwardButton = document.querySelector("#sendBackwardButton");
const addLineButton = document.querySelector("#addLineButton");
const projectSelect = document.querySelector("#projectSelect");
const templateSelect = document.querySelector("#templateSelect");
const newProjectButton = document.querySelector("#newProjectButton");
const duplicateProjectButton = document.querySelector("#duplicateProjectButton");
const deleteProjectButton = document.querySelector("#deleteProjectButton");

const storageKey = "invitation-generator-projects";

const controls = {
  text: document.querySelector("#blockText"),
  x: document.querySelector("#blockX"),
  y: document.querySelector("#blockY"),
  width: document.querySelector("#blockWidth"),
  height: document.querySelector("#blockHeight"),
  fontFamily: document.querySelector("#blockFont"),
  fontSize: document.querySelector("#blockFontSize"),
  fontWeight: document.querySelector("#blockWeight"),
  zIndex: document.querySelector("#blockZ"),
  align: document.querySelector("#blockAlign"),
  direction: document.querySelector("#blockDirection"),
  lineHeight: document.querySelector("#blockLineHeight"),
  color: document.querySelector("#blockColor"),
};

let layout = null;
let baseLayout = null;
let selectedId = null;
let dragState = null;
let projects = [];
let templateLayouts = [];
let currentProjectId = null;

function pageToCss(value, axis) {
  const pageSize = axis === "x" ? layout.page.width : layout.page.height;
  return `${(value / pageSize) * 100}%`;
}

function cssToPage(value, axis) {
  const rect = stage.getBoundingClientRect();
  const stageSize = axis === "x" ? rect.width : rect.height;
  const pageSize = axis === "x" ? layout.page.width : layout.page.height;
  return (value / stageSize) * pageSize;
}

function selectedBlock() {
  return layout.blocks.find((block) => block.id === selectedId) || layout.blocks[0];
}

function setStatus(message) {
  statusText.textContent = message;
  if (message) {
    window.clearTimeout(setStatus.timer);
    setStatus.timer = window.setTimeout(() => {
      statusText.textContent = "";
    }, 3500);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeTextBlock(overrides) {
  return {
    type: "text",
    id: "block",
    label: "Block",
    text: "",
    x: 0,
    y: 0,
    width: 120,
    height: 24,
    fontFamily: "InvitationHebrew",
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 1,
    color: "#151022",
    align: "center",
    direction: "rtl",
    zIndex: 0,
    ...overrides,
  };
}

function makeLineBlock(overrides = {}) {
  return {
    type: "line",
    id: `line-${Date.now()}`,
    label: "Line",
    text: "",
    x: 38,
    y: 118,
    width: 3,
    height: 360,
    fontFamily: "InvitationHebrew",
    fontSize: 10,
    fontWeight: "400",
    lineHeight: 1,
    color: "#151022",
    align: "left",
    direction: "ltr",
    zIndex: 0,
    ...overrides,
  };
}

function currentTemplateLayout() {
  return templateLayouts.find((item) => item.template.id === templateSelect.value) || baseLayout;
}

function layerForBlock(block) {
  if (block.id === "englishName") return 1;
  if (block.id === "hebrewName") return 2;
  const layer = Number(block.zIndex);
  return Number.isFinite(layer) && layer >= 0 && layer <= 2 ? layer : 0;
}

function normalizeLayers(sourceLayout) {
  const normalized = clone(sourceLayout);
  normalized.blocks = normalized.blocks.map((block) => ({
    ...block,
    zIndex: layerForBlock(block),
  }));
  return normalized;
}

function normalizeProjectLayout(sourceLayout) {
  return upgradeGrandparentsBlocks(sourceLayout);
}

function upgradeGrandparentsBlocks(sourceLayout) {
  const upgraded = normalizeLayers(sourceLayout);
  if (upgraded.blocks.some((block) => block.id === "grandparentsTitle")) {
    return upgraded;
  }

  const oldIndex = upgraded.blocks.findIndex((block) => block.id === "optionalGrandparents");
  if (oldIndex === -1) {
    return upgraded;
  }

  const oldBlock = upgraded.blocks[oldIndex];
  const lines = oldBlock.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines[0] || "תפארת בנים אבותם";
  const names = lines.slice(1).join(" ");
  const nameParts = names.includes("         ")
    ? names.split(/\s{3,}/).map((line) => line.trim()).filter(Boolean)
    : lines.slice(1);

  upgraded.blocks.splice(
    oldIndex,
    1,
    makeTextBlock({
      id: "grandparentsTitle",
      label: "Grandparents title",
      text: title,
      x: 132,
      y: 560,
      width: 236,
      height: 18,
      fontSize: 11.5,
    }),
    makeTextBlock({
      id: "grandparentsRight",
      label: "Grandparents right",
      text: nameParts[0] || "ר’ שמוא-ל מנחם שפיגל ורעיתו",
      x: 224,
      y: 588,
      width: 154,
      height: 18,
      fontSize: 10.7,
    }),
    makeTextBlock({
      id: "grandparentsLeft",
      label: "Grandparents left",
      text: nameParts[1] || "ר’ יוסף יודא הלוי ספיירו ורעיתו",
      x: 34,
      y: 588,
      width: 168,
      height: 18,
      fontSize: 10.7,
    })
  );

  return upgraded;
}

function makeProjectName(prefix = "Invitation") {
  const now = new Date();
  const stamp = now.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${prefix} ${stamp}`;
}

function readProjects() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function writeProjects() {
  localStorage.setItem(storageKey, JSON.stringify(projects));
}

function currentProject() {
  return projects.find((project) => project.id === currentProjectId);
}

function renderProjectOptions() {
  projectSelect.innerHTML = "";
  projects.forEach((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    projectSelect.append(option);
  });
  projectSelect.value = currentProjectId || "";
}

function renderTemplateOptions() {
  templateSelect.innerHTML = "";
  templateLayouts.forEach((templateLayout) => {
    const option = document.createElement("option");
    option.value = templateLayout.template.id;
    option.textContent = templateLayout.template.name;
    templateSelect.append(option);
  });
}

function updateStagePreview() {
  const preview = layout?.template?.preview || "blank-150dpi.png";
  const image = stage.querySelector("img");
  image.src = `/template-preview.png?preview=${encodeURIComponent(preview)}`;
}

function saveCurrentProjectToStorage() {
  const project = currentProject();
  if (!project) return;
  project.layout = clone(layout);
  project.updatedAt = new Date().toISOString();
  writeProjects();
  renderProjectOptions();
}

function loadProject(projectId) {
  const project = projects.find((item) => item.id === projectId);
  if (!project) return;
  currentProjectId = project.id;
  layout = normalizeProjectLayout(project.layout);
  project.layout = clone(layout);
  writeProjects();
  templateSelect.value = layout.template?.id || "classic";
  selectedId = layout.blocks[0]?.id;
  renderProjectOptions();
  renderBlockOptions();
  updateStagePreview();
  syncControls();
  renderBlocks();
  setStatus(`Opened ${project.name}.`);
}

function createProject(name, sourceLayout) {
  const project = {
    id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    layout: clone(sourceLayout),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  projects.unshift(project);
  currentProjectId = project.id;
  writeProjects();
  loadProject(project.id);
  return project;
}

function renderBlockOptions() {
  blockSelect.innerHTML = "";
  layout.blocks.forEach((block) => {
    const option = document.createElement("option");
    option.value = block.id;
    option.textContent = block.label;
    blockSelect.append(option);
  });
}

function blockStyle(block) {
  const style = {
    left: pageToCss(block.x, "x"),
    top: pageToCss(block.y, "y"),
    width: pageToCss(block.width, "x"),
    height: pageToCss(block.height, "y"),
    fontFamily: `"${block.fontFamily}", serif`,
    fontSize: `${(block.fontSize / layout.page.width) * 100}cqw`,
    fontWeight: block.fontWeight,
    lineHeight: block.lineHeight,
    color: block.color,
    textAlign: block.align,
    direction: block.direction,
    zIndex: block.zIndex,
  };

  if (block.rotation) {
    style.transform = `rotate(${block.rotation}deg)`;
    style.transformOrigin = "center";
  }

  if (block.type === "line") {
    style.background = block.color;
    style.fontSize = "0";
  }

  return style;
}

function renderBlocks() {
  blockLayer.innerHTML = "";
  [...layout.blocks]
    .sort((a, b) => a.zIndex - b.zIndex)
    .forEach((block) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = `layout-block ${block.type === "line" ? "line-block" : "text-block"}${
        block.id === selectedId ? " is-selected" : ""
      }`;
      element.dataset.id = block.id;
      element.dir = block.direction;
      element.textContent = block.type === "line" ? "" : block.text;

      Object.assign(element.style, blockStyle(block));

      const handle = document.createElement("span");
      handle.className = "resize-handle";
      element.append(handle);
      blockLayer.append(element);
    });
}

function syncControls() {
  const block = selectedBlock();
  if (!block) return;

  selectedId = block.id;
  blockSelect.value = block.id;
  controls.text.disabled = block.type === "line";
  controls.fontFamily.disabled = block.type === "line";
  controls.fontSize.disabled = block.type === "line";
  controls.fontWeight.disabled = block.type === "line";
  controls.align.disabled = block.type === "line";
  controls.direction.disabled = block.type === "line";
  controls.lineHeight.disabled = block.type === "line";
  controls.text.value = block.text;
  controls.x.value = Math.round(block.x);
  controls.y.value = Math.round(block.y);
  controls.width.value = Math.round(block.width);
  controls.height.value = Math.round(block.height);
  controls.fontFamily.value = block.fontFamily;
  controls.fontSize.value = block.fontSize;
  controls.fontWeight.value = block.fontWeight;
  controls.zIndex.value = block.zIndex;
  controls.align.value = block.align;
  controls.direction.value = block.direction;
  controls.lineHeight.value = block.lineHeight;
  controls.color.value = block.color;
}

function selectBlock(id) {
  selectedId = id;
  syncControls();
  renderBlocks();
}

function updateSelected(patch) {
  const block = selectedBlock();
  Object.assign(block, patch);
  block.zIndex = layerForBlock(block);
  syncControls();
  renderBlocks();
  saveCurrentProjectToStorage();
}

function clampBlock(block) {
  block.width = Math.max(8, Math.min(block.width, layout.page.width - block.x));
  block.height = Math.max(8, Math.min(block.height, layout.page.height - block.y));
  block.x = Math.max(0, Math.min(block.x, layout.page.width - block.width));
  block.y = Math.max(0, Math.min(block.y, layout.page.height - block.height));
}

function readControlPatch() {
  return {
    text: controls.text.value,
    x: Number(controls.x.value),
    y: Number(controls.y.value),
    width: Number(controls.width.value),
    height: Number(controls.height.value),
    fontFamily: controls.fontFamily.value,
    fontSize: Number(controls.fontSize.value),
    fontWeight: controls.fontWeight.value,
    zIndex: Number(controls.zIndex.value),
    align: controls.align.value,
    direction: controls.direction.value,
    lineHeight: Number(controls.lineHeight.value),
    color: controls.color.value,
  };
}

async function loadLayout() {
  const response = await fetch("/api/templates");
  if (!response.ok) throw new Error("Could not load layout");
  templateLayouts = await response.json();
  templateLayouts = templateLayouts.map(normalizeProjectLayout);
  baseLayout = templateLayouts[0];
  renderTemplateOptions();
  projects = readProjects();

  if (!projects.length) {
    createProject(makeProjectName("Invitation"), currentTemplateLayout());
    setStatus("Created your first local project.");
    return;
  }

  const lastProjectId = localStorage.getItem(`${storageKey}:current`);
  const project = projects.find((item) => item.id === lastProjectId) || projects[0];
  loadProject(project.id);
}

async function saveLayout() {
  saveLayoutButton.disabled = true;
  try {
    const project = currentProject();
    if (project) {
      const nextName = prompt("Project name", project.name);
      if (nextName && nextName.trim()) {
        project.name = nextName.trim();
      }
    }
    saveCurrentProjectToStorage();
    localStorage.setItem(`${storageKey}:current`, currentProjectId);

    const response = await fetch("/api/layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(layout),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Could not save layout");
    }
    const result = await response.json();
    setStatus(
      result.savedToServer === false
        ? "Project saved locally. Server template saves need a database on Vercel."
        : "Project saved locally, and current layout saved as the template."
    );
  } finally {
    saveLayoutButton.disabled = false;
  }
}

async function generatePdf() {
  generateButton.disabled = true;
  generateButton.textContent = "Generating...";
  try {
    const outputMode = document.querySelector('input[name="outputMode"]:checked').value;
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout, outputMode }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "PDF generation failed");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = outputMode === "two-up" ? "invitation-two-up.pdf" : "invitation.pdf";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = "Generate PDF";
  }
}

function startDrag(event) {
  const blockElement = event.target.closest(".layout-block");
  if (!blockElement) return;

  const block = layout.blocks.find((item) => item.id === blockElement.dataset.id);
  selectBlock(block.id);

  const rect = stage.getBoundingClientRect();
  const isResize = event.target.classList.contains("resize-handle");
  dragState = {
    id: block.id,
    isResize,
    startX: event.clientX,
    startY: event.clientY,
    block: { ...block },
    rect,
  };

  blockElement.setPointerCapture(event.pointerId);
}

function moveDrag(event) {
  if (!dragState) return;
  const block = selectedBlock();
  const dx = cssToPage(event.clientX - dragState.startX, "x");
  const dy = cssToPage(event.clientY - dragState.startY, "y");

  if (dragState.isResize) {
    block.width = dragState.block.width + dx;
    block.height = dragState.block.height + dy;
  } else {
    block.x = dragState.block.x + dx;
    block.y = dragState.block.y + dy;
  }

  block.zIndex = layerForBlock(block);
  clampBlock(block);
  syncControls();
  renderBlocks();
}

function stopDrag() {
  if (dragState) {
    saveCurrentProjectToStorage();
  }
  dragState = null;
}

Object.values(controls).forEach((control) => {
  control.addEventListener("input", () => {
    const block = selectedBlock();
    Object.assign(block, readControlPatch());
    block.zIndex = layerForBlock(block);
    clampBlock(block);
    syncControls();
    renderBlocks();
    saveCurrentProjectToStorage();
  });
});

blockSelect.addEventListener("change", () => selectBlock(blockSelect.value));
saveLayoutButton.addEventListener("click", () => saveLayout().catch((error) => alert(error.message)));
generateButton.addEventListener("click", () => generatePdf().catch((error) => alert(error.message)));
addLineButton.addEventListener("click", () => {
  const lineNumber = layout.blocks.filter((block) => block.type === "line").length + 1;
  const block = makeLineBlock({
    id: `line-${Date.now()}`,
    label: `Line ${lineNumber}`,
  });
  layout.blocks.push(block);
  selectedId = block.id;
  renderBlockOptions();
  syncControls();
  renderBlocks();
  saveCurrentProjectToStorage();
});
projectSelect.addEventListener("change", () => {
  localStorage.setItem(`${storageKey}:current`, projectSelect.value);
  loadProject(projectSelect.value);
});

newProjectButton.addEventListener("click", () => {
  const name = prompt("Project name", makeProjectName("Invitation"));
  if (!name || !name.trim()) return;
  createProject(name.trim(), currentTemplateLayout());
  localStorage.setItem(`${storageKey}:current`, currentProjectId);
});

duplicateProjectButton.addEventListener("click", () => {
  const source = currentProject();
  if (!source) return;
  const name = prompt("Project name", `${source.name} copy`);
  if (!name || !name.trim()) return;
  createProject(name.trim(), layout);
  localStorage.setItem(`${storageKey}:current`, currentProjectId);
});

deleteProjectButton.addEventListener("click", () => {
  const project = currentProject();
  if (!project || projects.length <= 1) {
    alert("Keep at least one project.");
    return;
  }
  if (!confirm(`Delete ${project.name}?`)) return;
  projects = projects.filter((item) => item.id !== project.id);
  currentProjectId = projects[0].id;
  writeProjects();
  localStorage.setItem(`${storageKey}:current`, currentProjectId);
  loadProject(currentProjectId);
});

bringForwardButton.addEventListener("click", () => updateSelected({ zIndex: selectedBlock().zIndex + 1 }));
sendBackwardButton.addEventListener("click", () => updateSelected({ zIndex: selectedBlock().zIndex - 1 }));

blockLayer.addEventListener("pointerdown", startDrag);
window.addEventListener("pointermove", moveDrag);
window.addEventListener("pointerup", stopDrag);

window.addEventListener("keydown", (event) => {
  if (!selectedId || ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;
  const block = selectedBlock();
  const amount = event.shiftKey ? 10 : 1;
  const moves = {
    ArrowLeft: { x: block.x - amount },
    ArrowRight: { x: block.x + amount },
    ArrowUp: { y: block.y - amount },
    ArrowDown: { y: block.y + amount },
  };
  if (!moves[event.key]) return;
  event.preventDefault();
  Object.assign(block, moves[event.key]);
  block.zIndex = layerForBlock(block);
  clampBlock(block);
  syncControls();
  renderBlocks();
  saveCurrentProjectToStorage();
});

loadLayout().catch((error) => alert(error.message));
