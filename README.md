# Bridger

The marketing site for Bridger, the Bridge Financial arm that builds websites,
mobile apps and workflow automation. Lives at **getbridger.ai**.

One static page and one serverless function. There is no framework and no build
step: what is in this repo is what gets served.

```
public/index.html             the whole page, CSS and JS inline
public/assets/img/            screenshots, people, the brand mark, the OG card
public/assets/fonts/          Manrope and Sora, self-hosted (no Google Fonts link)
netlify/functions/contact.mjs receives the contact form, mails it on through Resend
netlify.toml                  what to publish and where the function lives
```

`public/` is what gets served. The function sits outside it so its source is
never handed out as a static file.

## Working on it

Open `public/index.html` in a browser. That is the whole loop for anything
except the form, which needs the function running:

```sh
npx netlify dev
```

Edits are plain HTML and CSS in one file. The CSS sits above the markup it
styles so a slow connection never paints unstyled content.

## Deploying

Netlify builds from `main`. Pushing deploys. There is no build command; the
contents of `public/` are published as they are.

The contact form needs three environment variables set in the Netlify site.
They are not in this repo:

| Variable | What it is |
|---|---|
| `RESEND_API_KEY` | Resend API key |
| `CONTACT_TO` | who gets the enquiry, comma separated |
| `CONTACT_FROM` | the From address, on a domain verified in Resend |

Without them `/api/contact` returns 500 and the page shows its failure line, so
a missing variable is visible rather than silent. `CONTACT_FROM` has to sit on
a domain verified in Resend, currently `getbridger.ai`.

## How the form behaves

The browser enforces the required fields, and `data-phone-format="us"` formats
the number as it is typed and rejects anything that is not ten digits. That
script is copied verbatim from the app
(`backend/apps/common/static/js/phone-format.js` in `bridge-portal`); change it
there first.

On submit the button flips to its sent state immediately rather than waiting on
the request, because the send is what the person came to do. If the request
fails the button is put back and a line appears telling them what happened.

`api/contact.js` drops anything that fills the hidden `company` field, since
only a bot can see it, and answers those with a 200 so there is nothing to retry
against.

## Assets

Screenshots are from the Bridge app and from a client workspace app. Logos and
client names in them are blurred. The photos are from Unsplash, whose license
covers commercial use, but confirm a photo's page before relying on it.
