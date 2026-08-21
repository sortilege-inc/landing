// Sortilege onboarding — Mailgun shim.
//
// The form is a static page, so it cannot hold a Mailgun key. This Worker does:
// it takes the form POST, renders it as an email, and calls Mailgun with the key
// stored as a Worker secret (never in this repo).
//
// Field names are NOT hardcoded. The form's content is still being decided, so
// the body is rendered generically from whatever keys arrive — adding or renaming
// a form field needs no change here.

const MAILGUN_HOST = { us: 'api.mailgun.net', eu: 'api.eu.mailgun.net' };

/** Fields that are handled specially rather than dumped into the body. */
const NAME_KEYS = ['name', 'your-name', 'fullname'];
const EMAIL_KEYS = ['email', 'your-email'];
const HONEYPOT = 'website'; // real people never see this input; bots fill it in

const LABELS = {
  name: 'Name',
  email: 'Email',
  experience: 'Experience',
  after: "The feeling they're after",
  when: "When they're free",
  notes: 'Anything I should know',
  src: 'Scanned from',
};

function pick(data, keys) {
  for (const k of keys) {
    if (typeof data[k] === 'string' && data[k].trim()) return data[k].trim();
  }
  return '';
}

function label(key) {
  return LABELS[key] || key.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Renders the whole submission as plain text, longest answers last. */
function renderBody(data) {
  const lines = [];
  for (const [key, raw] of Object.entries(data)) {
    if (key === HONEYPOT) continue;
    const value = Array.isArray(raw) ? raw.join(', ') : String(raw ?? '').trim();
    if (!value) continue;
    lines.push(value.includes('\n') ? `${label(key)}:\n${value}\n` : `${label(key)}: ${value}`);
  }
  return lines.length ? lines.join('\n') : '(empty submission)';
}

function corsHeaders(env, request) {
  const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env, request);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ error: 'Expected JSON' }, 400, cors);
    }
    if (!data || typeof data !== 'object') return json({ error: 'Expected an object' }, 400, cors);

    // Spam trap. Answer 200 so bots do not learn they were caught.
    if (typeof data[HONEYPOT] === 'string' && data[HONEYPOT].trim()) {
      return json({ ok: true }, 200, cors);
    }

    const name = pick(data, NAME_KEYS);
    const email = pick(data, EMAIL_KEYS);
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: 'A valid email address is required.' }, 400, cors);
    }

    const host = MAILGUN_HOST[(env.MG_REGION || 'us').toLowerCase()] || MAILGUN_HOST.us;
    const form = new FormData();
    form.set('from', `Sortilege Onboarding <onboarding@${env.MG_DOMAIN}>`);
    form.set('to', env.MG_TO);
    form.set('subject', `A seat request${name ? ` — ${name}` : ''}`);
    form.set('h:Reply-To', name ? `${name} <${email}>` : email);
    form.set('text', renderBody(data));

    const response = await fetch(`https://${host}/v3/${env.MG_DOMAIN}/messages`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`api:${env.MAILGUN_API_KEY}`)}` },
      body: form,
    });

    if (!response.ok) {
      // Log upstream detail for us; never return it to the browser.
      console.error('Mailgun rejected the send', response.status, await response.text());
      return json({ error: 'Could not send right now.' }, 502, cors);
    }

    return json({ ok: true }, 200, cors);
  },
};
