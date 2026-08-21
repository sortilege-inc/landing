# Sortilege onboarding — Mailgun shim

The form is a static page on GitHub Pages, so it cannot hold a Mailgun API key.
This Worker sits between them: it accepts the form POST, renders the submission
as plain text, and calls the Mailgun API using a key stored as a Worker secret.

## Before deploying

Fill in two values in `wrangler.toml`:

- `MG_REGION` — `us` (api.mailgun.net) or `eu` (api.eu.mailgun.net).
- `MG_DOMAIN` — the **verified sending domain** in your Mailgun account.

## Deploy

```bash
cd worker
npx wrangler login
npx wrangler secret put MAILGUN_API_KEY   # paste the key at the prompt
npx wrangler deploy
```

`wrangler deploy` prints the Worker URL. Put that in `ENDPOINT` at the top of
`../app.js`, then commit and push.

**The API key never belongs in this repo.** `wrangler secret put` stores it with
Cloudflare and reads it from a prompt, so it is not in your shell history either.

## Notes

- Field names are not hardcoded. The email body is rendered from whatever keys
  arrive, so the form's content pass needs no change here. `LABELS` in
  `src/index.js` only prettifies known keys; unknown ones are title-cased.
- `Reply-To` is set to the submitter, so replying from your mail client goes
  straight back to them.
- A hidden `website` field is a honeypot. If it is filled the Worker returns
  200 and sends nothing, so bots cannot tell they were caught.
- Mailgun errors are logged (`wrangler tail`) but never returned to the browser.
