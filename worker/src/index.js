// Sortilege onboarding — Mailgun shim.
//
// The form is a static page, so it cannot hold a Mailgun key. This Worker does:
// it takes the form POST, renders it as an email, and calls Mailgun with the key
// stored as a Worker secret (never in this repo).
//
// Unknown field names are rendered generically, so adding a question to the form
// needs no change here. LABELS and ORDER only control presentation of known ones.

const MAILGUN_HOST = { us: 'api.mailgun.net', eu: 'api.eu.mailgun.net' };

const NAME_KEYS = ['name'];
const EMAIL_KEYS = ['email'];
const CONTACT_KEYS = ['email', 'mobile', 'discord'];
const HONEYPOT = 'website'; // real people never see this input; bots fill it in

const LABELS = {
  name: 'Name',
  pronouns: 'Pronouns',
  'pronouns-other': 'Pronouns (write-in)',
  generation: 'Age group',
  about: 'About them',
  experience: 'Experience',
  'experience-notes': 'Experience notes',
  format: 'Plays',
  timezone: 'Time zone',
  'contact-methods': 'Contact via',
  'contact-preferred': 'Prefers',
  email: 'Email',
  mobile: 'Mobile',
  discord: 'Discord',
  'avail-mon': 'Mon', 'avail-tue': 'Tue', 'avail-wed': 'Wed', 'avail-thu': 'Thu',
  'avail-fri': 'Fri', 'avail-sat': 'Sat', 'avail-sun': 'Sun',
  'avail-mon-winnipeg': 'Mon → Winnipeg', 'avail-tue-winnipeg': 'Tue → Winnipeg',
  'avail-wed-winnipeg': 'Wed → Winnipeg', 'avail-thu-winnipeg': 'Thu → Winnipeg',
  'avail-fri-winnipeg': 'Fri → Winnipeg', 'avail-sat-winnipeg': 'Sat → Winnipeg',
  'avail-sun-winnipeg': 'Sun → Winnipeg',
  note: 'Note',
  frequency: 'How often',
  duration: 'How long',
  location: 'Where',
  'location-other': 'Where (write-in)',
  company: 'Who with',
  'cost-assistance': 'Cost assistance',
  systems: 'Systems',
  vibes: 'Vibe & genre',
  lines: 'LINES — not at all',
  veils: 'VEILS — not prominently',
  'boundaries-notes': 'Boundary notes',
  'company-other': 'Other preferences (write-in)',
  newsletter: 'Newsletter',
  event: 'Event',
  ref: 'Reference',
  waitlist: 'WAITLIST',
  'session-dates': 'Dates that work',
  'session-dates-other': 'Dates (write-in)',
  src: 'Scanned from',
};

/** Presentation order; anything not listed is appended in arrival order. */
const ORDER = [
  'event', 'name', 'pronouns', 'pronouns-other', 'generation', 'about',
  'contact-methods', 'contact-preferred', 'email', 'mobile', 'discord',
  'format', 'timezone',
  'experience', 'experience-notes',
  'avail-mon', 'avail-mon-winnipeg', 'avail-tue', 'avail-tue-winnipeg',
  'avail-wed', 'avail-wed-winnipeg', 'avail-thu', 'avail-thu-winnipeg',
  'avail-fri', 'avail-fri-winnipeg', 'avail-sat', 'avail-sat-winnipeg',
  'avail-sun', 'avail-sun-winnipeg',
  'frequency', 'duration', 'location', 'location-other', 'company', 'company-other',
  'session-dates', 'session-dates-other',
  'systems', 'vibes', 'lines', 'veils', 'boundaries-notes',
  'cost-assistance', 'newsletter', 'note', 'src', 'ref', 'waitlist',
];

function pick(data, keys) {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function label(key) {
  return LABELS[key] || key.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const isEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

/** Renders the whole submission as plain text, known fields first. */
function renderBody(data) {
  const keys = [
    ...ORDER.filter((k) => k in data),
    ...Object.keys(data).filter((k) => !ORDER.includes(k)),
  ];
  const lines = [];
  for (const key of keys) {
    if (key === HONEYPOT || key === 'kind' || key === 'cc') continue;
    const raw = data[key];
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

    // Any one contact method is enough — the form lets people give a mobile
    // number or a Discord handle instead of an email.
    if (!pick(data, CONTACT_KEYS)) {
      return json({ error: 'Please give at least one way to reach you.' }, 400, cors);
    }

    const email = pick(data, EMAIL_KEYS);
    if (email && !isEmail(email)) {
      return json({ error: 'That email address does not look right.' }, 400, cors);
    }

    const name = pick(data, NAME_KEYS);
    const host = MAILGUN_HOST[(env.MG_REGION || 'us').toLowerCase()] || MAILGUN_HOST.us;

    const form = new FormData();
    form.set('from', `Sortilege Onboarding <onboarding@${env.MG_DOMAIN}>`);
    form.set('to', env.MG_TO);
    // Both sites post here. The landing form sends no `kind` and keeps the
    // original subject; the registration site sends "Registration — <event>",
    // so the two are told apart at a glance in the inbox.
    const kind = typeof data.kind === 'string' && data.kind.trim()
      ? data.kind.trim().slice(0, 60)
      : 'A seat request';
    form.set('subject', `${kind}${name ? ` — ${name}` : ''}`);
    form.set('text', renderBody(data));
    // Only meaningful when they actually gave an address to reply to.
    if (email) form.set('h:Reply-To', name ? `${name} <${email}>` : email);
    // The registration site asks for `cc: true` so the person who signed up gets
    // their own copy as the confirmation. The landing form sends no `cc` and is
    // unaffected — it is an intake, not a booking, and copying people in on it
    // would be a surprise.
    if (data.cc === true && email) form.set('cc', email);

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
