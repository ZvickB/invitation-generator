const fs = require("fs");
const path = require("path");
const { degrees, PDFDocument } = require("pdf-lib");

const projectRoot = path.resolve(__dirname, "..");
const inputPdf = process.argv[2] || path.join(projectRoot, "templates", "blank.pdf");
const outputPdf =
  process.argv[3] || path.join(projectRoot, "outputs", "two-up-letter-portrait-rotated.pdf");

// US Letter in PDF points. Keep the page portrait so printers do not need landscape mode.
const pageWidth = 8.5 * 72;
const pageHeight = 11 * 72;

// Small printer-friendly margin around the sheet and between copies.
const outerMargin = 18;
const gutter = 18;

function getFitScale(sourceWidth, sourceHeight, boxWidth, boxHeight) {
  return Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
}

function drawRotatedCopy(page, embeddedPage, boxX, boxY, boxWidth, boxHeight) {
  const scale = getFitScale(embeddedPage.height, embeddedPage.width, boxWidth, boxHeight);
  const placedWidth = embeddedPage.width * scale;
  const placedHeight = embeddedPage.height * scale;

  const centeredX = boxX + (boxWidth - placedHeight) / 2;
  const centeredY = boxY + (boxHeight - placedWidth) / 2;

  page.drawPage(embeddedPage, {
    x: centeredX + placedHeight,
    y: centeredY,
    width: placedWidth,
    height: placedHeight,
    rotate: degrees(90),
  });
}

async function main() {
  const sourceBytes = fs.readFileSync(inputPdf);
  const sourceDoc = await PDFDocument.load(sourceBytes);
  const outputDoc = await PDFDocument.create();

  const copyWidth = pageWidth - outerMargin * 2;
  const copyHeight = (pageHeight - outerMargin * 2 - gutter) / 2;
  const bottomY = outerMargin;
  const topY = outerMargin + copyHeight + gutter;
  const copyX = outerMargin;

  for (let pageIndex = 0; pageIndex < sourceDoc.getPageCount(); pageIndex += 1) {
    const [embeddedPage] = await outputDoc.embedPdf(sourceBytes, [pageIndex]);
    const page = outputDoc.addPage([pageWidth, pageHeight]);

    drawRotatedCopy(page, embeddedPage, copyX, topY, copyWidth, copyHeight);
    drawRotatedCopy(page, embeddedPage, copyX, bottomY, copyWidth, copyHeight);
  }

  const outputBytes = await outputDoc.save();
  fs.writeFileSync(outputPdf, outputBytes);
  console.log(`Created: ${outputPdf}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
