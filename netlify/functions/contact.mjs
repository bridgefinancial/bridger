// Receives the landing page's contact form and mails it on through Resend.
//
// Environment (set in the Netlify site, not here):
//   RESEND_API_KEY  the key
//   CONTACT_TO      who gets the mail, comma separated
//   CONTACT_FROM    the From address, on a domain verified in Resend

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// The page posts here; see the fetch in index.html.
export const config = { path: "/api/contact" };

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export default async function contact(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "POST" },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Expected JSON." });
  }

  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim();
  const want = Array.isArray(body.want) ? body.want.map(String) : [];

  // The honeypot is invisible to people. Anything in it is a bot, and it is
  // answered with a 200 so the bot has no signal to retry against.
  if (String(body.company || "").trim()) return json(200, { ok: true });

  if (!name || !phone || !email) {
    return json(400, { error: "Name, phone and email are all required." });
  }
  if (phone.replace(/\D/g, "").length !== 10) {
    return json(400, { error: "Phone must be a 10-digit US number." });
  }
  if (!EMAIL.test(email)) {
    return json(400, { error: "That email does not look right." });
  }
  // Long values mean a script, not a person filling in a form.
  if (name.length > 120 || email.length > 200 || want.join("").length > 200) {
    return json(400, { error: "That is too long." });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = (process.env.CONTACT_TO || "").split(",").map((s) => s.trim()).filter(Boolean);
  const from = process.env.CONTACT_FROM;
  if (!apiKey || !to.length || !from) {
    console.error("contact: missing RESEND_API_KEY, CONTACT_TO or CONTACT_FROM");
    return json(500, { error: "Not configured." });
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
      return json(502, { error: "Could not send." });
    }
  } catch (err) {
    console.error("contact: resend call failed", err);
    return json(502, { error: "Could not send." });
  }

  return json(200, { ok: true });
}
