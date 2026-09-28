// Receives the landing page's contact form and mails it on through Resend.
//
// Environment (set in the Vercel project, not here):
//   RESEND_API_KEY  the key
//   CONTACT_TO      who gets the mail, comma separated
//   CONTACT_FROM    the From address, on a domain verified in Resend

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim();
  const want = Array.isArray(body.want) ? body.want.map(String) : [];

  // The honeypot is invisible to people. Anything in it is a bot, and it is
  // answered with a 200 so the bot has no signal to retry against.
  if (String(body.company || "").trim()) return res.status(200).json({ ok: true });

  if (!name || !phone || !email) {
    return res.status(400).json({ error: "Name, phone and email are all required." });
  }
  if (phone.replace(/\D/g, "").length !== 10) {
    return res.status(400).json({ error: "Phone must be a 10-digit US number." });
  }
  if (!EMAIL.test(email)) {
    return res.status(400).json({ error: "That email does not look right." });
  }
  // Long values mean a script, not a person filling in a form.
  if (name.length > 120 || email.length > 200 || want.join("").length > 200) {
    return res.status(400).json({ error: "That is too long." });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = (process.env.CONTACT_TO || "").split(",").map((s) => s.trim()).filter(Boolean);
  const from = process.env.CONTACT_FROM;
  if (!apiKey || !to.length || !from) {
    console.error("contact: missing RESEND_API_KEY, CONTACT_TO or CONTACT_FROM");
    return res.status(500).json({ error: "Not configured." });
  }

  const lines = [
    `Name:  ${name}`,
    `Phone: ${phone}`,
    `Email: ${email}`,
    `Needs: ${want.length ? want.join(", ") : "(not specified)"}`,
  ];

  try {
    const sent = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        // Replying to the notification replies to whoever wrote in.
        reply_to: email,
        subject: `Bridger enquiry: ${name}`,
        text: lines.join("\n"),
        html: `<pre style="font:14px/1.6 ui-monospace,monospace">${escapeHtml(lines.join("\n"))}</pre>`,
      }),
    });

    if (!sent.ok) {
      console.error("contact: resend returned", sent.status, await sent.text());
      return res.status(502).json({ error: "Could not send." });
    }
  } catch (err) {
    console.error("contact: resend call failed", err);
    return res.status(502).json({ error: "Could not send." });
  }

  return res.status(200).json({ ok: true });
}
