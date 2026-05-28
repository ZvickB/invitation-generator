const fs = require("fs");
const path = require("path");

const fontsDir = path.join(__dirname, "..", "assets", "fonts");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  const rawName = Array.isArray(req.query.name) ? req.query.name[0] : req.query.name;
  const fontName = decodeURIComponent(rawName || "");
  const filePath = path.normalize(path.join(fontsDir, fontName));

  if (!filePath.startsWith(fontsDir) || path.extname(filePath).toLowerCase() !== ".ttf") {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "font/ttf");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.end(fs.readFileSync(filePath));
};
