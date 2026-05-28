const fs = require("fs");
const path = require("path");
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const { degrees, PDFDocument } = require("pdf-lib");

const projectRoot = path.resolve(__dirname, "..");
const templatePdfPath = path.join(projectRoot, "templates", "blank.pdf");
const previewPngPath = path.join(projectRoot, "previews", "blank-150dpi.png");
const layoutPath = path.join(projectRoot, "layout.json");

const defaultPage = {
  width: 396,
  height: 612,
};

const fontDir = path.join(projectRoot, "assets", "fonts");
const fontFiles = [
  { path: path.join(fontDir, "NotoSerifHebrew.ttf"), family: "InvitationHebrew" },
  { path: path.join(fontDir, "DavidLibre-Regular.ttf"), family: "David Libre Regular" },
  { path: path.join(fontDir, "DavidLibre-Bold.ttf"), family: "David Libre" },
  { path: path.join(fontDir, "LibertinusMath-Regular.ttf"), family: "Libertinus Math" },
  { path: path.join(fontDir, "DancingScript.ttf"), family: "Dancing Script" },
  { path: path.join(fontDir, "MonsieurLaDoulaise-Regular.ttf"), family: "Monsieur La Doulaise" },
  { path: path.join(fontDir, "CormorantGaramond.ttf"), family: "InvitationSerif" },
];

fontFiles.forEach((font) => {
  if (fs.existsSync(font.path)) {
    GlobalFonts.registerFromPath(font.path, font.family);
  }
});

function readLayout() {
  return JSON.parse(fs.readFileSync(layoutPath, "utf8"));
}

function writeLayout(layout) {
  const normalized = normalizeLayout(layout);
  fs.writeFileSync(layoutPath, `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

function normalizeLayout(layout = {}) {
  const page = layout.page || defaultPage;
  const blocks = Array.isArray(layout.blocks) ? layout.blocks : [];

  return {
    page: {
      width: Number(page.width) || defaultPage.width,
      height: Number(page.height) || defaultPage.height,
    },
    blocks: blocks.map((block, index) => ({
      type: block.type === "line" ? "line" : "text",
      id: String(block.id || `block-${index + 1}`),
      label: String(block.label || block.id || `Block ${index + 1}`),
      text: String(block.text ?? ""),
      x: numberOr(block.x, 0),
      y: numberOr(block.y, 0),
      width: Math.max(8, numberOr(block.width, 120)),
      height: Math.max(8, numberOr(block.height, 40)),
      fontFamily: String(block.fontFamily || "InvitationHebrew"),
      fontSize: Math.max(4, numberOr(block.fontSize, 14)),
      fontWeight: String(block.fontWeight || "400"),
      lineHeight: Math.max(0.5, numberOr(block.lineHeight, 1.35)),
      color: /^#[0-9a-f]{6}$/i.test(block.color || "") ? block.color : "#151022",
      align: ["left", "center", "right"].includes(block.align) ? block.align : "left",
      direction: block.direction === "ltr" ? "ltr" : "rtl",
      zIndex: layerForBlock(block),
    })),
  };
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function layerForBlock(block) {
  if (block.id === "englishName") return 1;
  if (block.id === "hebrewName") return 2;
  const layer = Number(block.zIndex);
  return Number.isFinite(layer) && layer >= 0 && layer <= 2 ? layer : 0;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function setFont(ctx, block) {
  ctx.font = `normal ${block.fontWeight} ${block.fontSize}px "${block.fontFamily}", "Noto Serif Hebrew", "Times New Roman", serif`;
}

function lineX(block) {
  if (block.align === "center") return block.x + block.width / 2;
  if (block.align === "right") return block.x + block.width;
  return block.x;
}

function drawTextBlock(ctx, block) {
  const rgb = hexToRgb(block.color);
  const lines = String(block.text || "").split(/\r?\n/);
  const lineStep = block.fontSize * block.lineHeight;
  const hasNameHalo = block.id === "hebrewName" || block.id === "englishName";

  setFont(ctx, block);
  ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  ctx.textAlign = block.align;
  ctx.textBaseline = "top";
  ctx.direction = block.direction;

  if (hasNameHalo) {
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.lineWidth = Math.max(3, block.fontSize * 0.13);
  }

  lines.forEach((line, index) => {
    const y = block.y + index * lineStep;
    if (y > block.y + block.height) return;
    const x = lineX(block);
    if (hasNameHalo) {
      ctx.strokeText(line, x, y, block.width);
    }
    ctx.fillText(line, x, y, block.width);
  });
}

function drawLineBlock(ctx, block) {
  const rgb = hexToRgb(block.color);
  ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  ctx.fillRect(block.x, block.y, block.width, block.height);
}

function drawOverlayPng(inputLayout) {
  const layout = normalizeLayout(inputLayout || readLayout());
  const scale = 4;
  const canvas = createCanvas(layout.page.width * scale, layout.page.height * scale);
  const ctx = canvas.getContext("2d");

  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, layout.page.width, layout.page.height);

  [...layout.blocks]
    .sort((a, b) => a.zIndex - b.zIndex)
    .forEach((block) => {
      if (block.type === "line") {
        drawLineBlock(ctx, block);
        return;
      }
      drawTextBlock(ctx, block);
    });

  return canvas.toBuffer("image/png");
}

async function createSingleInvitationPdf(inputLayout) {
  const layout = normalizeLayout(inputLayout || readLayout());
  const sourceBytes = fs.readFileSync(templatePdfPath);
  const pdfDoc = await PDFDocument.load(sourceBytes);
  const pdfPage = pdfDoc.getPage(0);

  const overlayImage = await pdfDoc.embedPng(drawOverlayPng(layout));
  pdfPage.drawImage(overlayImage, {
    x: 0,
    y: 0,
    width: layout.page.width,
    height: layout.page.height,
  });

  return pdfDoc.save();
}

function getFitScale(sourceWidth, sourceHeight, boxWidth, boxHeight) {
  return Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
}

function drawRotatedCopy(pdfPage, embeddedPage, boxX, boxY, boxWidth, boxHeight) {
  const scale = getFitScale(embeddedPage.height, embeddedPage.width, boxWidth, boxHeight);
  const placedWidth = embeddedPage.width * scale;
  const placedHeight = embeddedPage.height * scale;

  const centeredX = boxX + (boxWidth - placedHeight) / 2;
  const centeredY = boxY + (boxHeight - placedWidth) / 2;

  pdfPage.drawPage(embeddedPage, {
    x: centeredX + placedHeight,
    y: centeredY,
    width: placedWidth,
    height: placedHeight,
    rotate: degrees(90),
  });
}

async function createTwoUpLetterPdf(inputLayout) {
  const singleBytes = await createSingleInvitationPdf(inputLayout);
  const outputDoc = await PDFDocument.create();

  const pageWidth = 8.5 * 72;
  const pageHeight = 11 * 72;
  const outerMargin = 18;
  const gutter = 18;
  const copyWidth = pageWidth - outerMargin * 2;
  const copyHeight = (pageHeight - outerMargin * 2 - gutter) / 2;
  const bottomY = outerMargin;
  const topY = outerMargin + copyHeight + gutter;
  const copyX = outerMargin;

  const [embeddedPage] = await outputDoc.embedPdf(singleBytes, [0]);
  const pdfPage = outputDoc.addPage([pageWidth, pageHeight]);

  drawRotatedCopy(pdfPage, embeddedPage, copyX, topY, copyWidth, copyHeight);
  drawRotatedCopy(pdfPage, embeddedPage, copyX, bottomY, copyWidth, copyHeight);

  return outputDoc.save();
}

module.exports = {
  createSingleInvitationPdf,
  createTwoUpLetterPdf,
  normalizeLayout,
  previewPngPath,
  readLayout,
  writeLayout,
};
