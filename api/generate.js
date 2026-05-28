const {
  createSingleInvitationPdf,
  createTwoUpLetterPdf,
} = require("../src/invitation-template");

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const pdfBytes =
      body.outputMode === "two-up"
        ? await createTwoUpLetterPdf(body.layout)
        : await createSingleInvitationPdf(body.layout);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="generated-invitation.pdf"');
    res.end(Buffer.from(pdfBytes));
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
};
