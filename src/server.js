const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  createSingleInvitationPdf,
  createTwoUpLetterPdf,
  previewPngPath,
  getPreviewPngPath,
  readLayout,
  readTemplateLayouts,
  writeLayout,
} = require("./invitation-template");

const publicDir = path.join(__dirname, "..", "public");
const fontsDir = path.join(__dirname, "..", "assets", "fonts");
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".pdf": "application/pdf",
  ".ttf": "font/ttf",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, body) {
  send(res, status, JSON.stringify(body), {
    "Content-Type": "application/json; charset=utf-8",
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(publicDir, pathname));

  if (!filePath.startsWith(publicDir)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, "Not found");
      return;
    }

    send(res, 200, data, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
    });
  });
}

function serveFont(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const fontName = decodeURIComponent(url.pathname.replace("/fonts/", ""));
  const filePath = path.normalize(path.join(fontsDir, fontName));

  if (!filePath.startsWith(fontsDir)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, "Not found");
      return;
    }

    send(res, 200, data, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/layout") {
      sendJson(res, 200, readLayout());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/templates") {
      sendJson(res, 200, readTemplateLayouts());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/layout") {
      const body = JSON.parse(await readBody(req));
      sendJson(res, 200, writeLayout(body));
      return;
    }

    if (req.method === "GET" && url.pathname === "/template-preview.png") {
      send(res, 200, fs.readFileSync(getPreviewPngPath(url.searchParams.get("preview"))), {
        "Content-Type": "image/png",
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/generate") {
      const body = JSON.parse(await readBody(req));
      const pdfBytes =
        body.outputMode === "two-up"
          ? await createTwoUpLetterPdf(body.layout)
          : await createSingleInvitationPdf(body.layout);

      send(res, 200, Buffer.from(pdfBytes), {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="generated-invitation.pdf"',
      });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/fonts/")) {
      serveFont(req, res);
      return;
    }

    if (req.method === "GET") {
      serveStatic(req, res);
      return;
    }

    send(res, 405, "Method not allowed");
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Invitation generator running at http://localhost:${port}`);
});
