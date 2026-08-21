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

## Troubleshooting: `wrangler login` fails with "fetch failed"

Not a Cloudflare problem. This machine has a global-scope IPv6 address on
`tailscale0` but **no IPv6 default route**. Node's Happy Eyeballs
(`autoSelectFamily`, default-on since Node 20) therefore races IPv6
connections that black-hole, and every `fetch` ends in `ETIMEDOUT` — which
wrangler reports as a bare `fetch failed`. It affects all hosts, not just
Cloudflare; `curl` is unaffected because it has its own implementation.

Prefix any wrangler command:

```bash
NODE_OPTIONS=--no-network-family-autoselection npx wrangler login
```

Verified: without the flag `fetch` to the Cloudflare API fails `ETIMEDOUT`
in ~1.5s; with it, `HTTP 400` (the expected "no token" reply) in ~1.1s.
`--network-family-autoselection-attempt-timeout=2000` also works.

This applies to every Node fetch-based tool on this machine.
