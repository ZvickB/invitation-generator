const { createCanvas } = require('pdfjs-dist/node_modules/@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Canvas factory required by pdfjs-dist for Node.js rendering
class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    return { canvas, context };
  }
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

async function convertPdfToPng(pdfPath, outputDir, dpi = 300) {
  const projectRoot = path.resolve(__dirname, "..");
  const scale = dpi / 72;
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // Point to the worker file for Node.js (must be a file:// URL on Windows)
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.join(projectRoot, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
  ).href;

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  });
  const pdf = await loadingTask.promise;

  console.log(`PDF loaded: ${pdf.numPages} page(s)`);

  const canvasFactory = new NodeCanvasFactory();
  const baseName = path.basename(pdfPath, path.extname(pdfPath));

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
    const { canvas, context } = canvasAndContext;

    // Fill white background
    context.fillStyle = 'white';
    context.fillRect(0, 0, viewport.width, viewport.height);

    await page.render({
      canvasContext: context,
      viewport,
      canvasFactory,
    }).promise;

    const suffix = pdf.numPages > 1 ? `-page${pageNum}` : '';
    const outPath = path.join(outputDir, `${baseName}${suffix}-${dpi}dpi.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved: ${outPath}`);

    canvasFactory.destroy(canvasAndContext);
  }
}

// Find the target PDF: use CLI arg, or auto-detect the printer-friendly PDF in the current dir.
let pdfPath = process.argv[2];
if (!pdfPath) {
  const templateDir = path.resolve(__dirname, '..', 'templates');
  const files = fs.readdirSync(templateDir);
  pdfPath = files.find(f => f.endsWith('-portrait-rotated.pdf')) ||
            files.find(f => f.endsWith('-landscape.pdf')) ||
            files.find(f => f.endsWith('.pdf'));
  if (!pdfPath) {
    console.error('No PDF found in current directory.');
    process.exit(1);
  }
  pdfPath = path.join(templateDir, pdfPath);
  console.log(`Auto-detected: ${pdfPath}`);
}
const outputDir = process.argv[3] || path.resolve(__dirname, '..', 'previews');
const dpi = Number(process.argv[4] || 300);

convertPdfToPng(pdfPath, outputDir, dpi).catch(err => {
  console.error('Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
