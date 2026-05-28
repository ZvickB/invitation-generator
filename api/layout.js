const { readLayout, normalizeLayout } = require("../src/invitation-template");

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      sendJson(res, 200, readLayout());
      return;
    }

    if (req.method === "POST") {
      const layout = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      sendJson(res, 200, {
        ...normalizeLayout(layout),
        savedToServer: false,
      });
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
};
