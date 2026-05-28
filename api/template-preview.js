const fs = require("fs");
const { getPreviewPngPath } = require("../src/invitation-template");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.end(fs.readFileSync(getPreviewPngPath(req.query.preview)));
};
