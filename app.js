// Sortilege onboarding form — submission handling.
//
// Posts the whole form as JSON to the Cloudflare Worker in ./worker, which holds
// the Mailgun key and does the actual send. If ENDPOINT is null the form logs the
// payload instead of sending, which is the useful mode when editing locally.

const ENDPOINT = 'https://sortilege-onboarding.sortilege.workers.dev';

const EXPERIENCE = {
  1: 'Never played anything',
  2: "I've played D&D once or twice",
  3: "I've regularly played D&D, or dabbled in something different",
  4: "I've GMed, or played campaigns in multiple systems",
};

const form = document.getElementById('onboard');
const status = document.getElementById('status');
const submit = form.querySelector('button[type="submit"]');

/* ---------- Which printed QR this scan came from ---------- */

const src = new URLSearchParams(location.search).get('src');
if (src) form.querySelector('input[name="src"]').value = src.slice(0, 60);

/* ---------- Open games ---------- */

const cards = document.getElementById('open-games');
for (const game of window.OPEN_GAMES || []) {
  const a = document.createElement('a');
  a.className = 'card';
  a.href = game.url;
  a.target = '_blank';
  a.rel = 'noopener';
  const meta = [game.price, game.length, game.schedule, game.format].filter(Boolean);
  a.innerHTML = `
    <p class="card__system"></p>
    <p class="card__title"></p>
    <p class="card__pitch"></p>
    <p class="card__meta">${meta.map(() => '<span></span>').join('')}</p>`;
  // Set text via textContent so game copy can never inject markup.
  a.querySelector('.card__system').textContent = game.system;
  a.querySelector('.card__title').textContent = game.title;
  a.querySelector('.card__pitch').textContent = game.pitch;
  a.querySelectorAll('.card__meta span').forEach((el, i) => { el.textContent = meta[i]; });
  cards.append(a);
}

const discord = document.getElementById('discord-link');
if (window.DISCORD_INVITE) {
  discord.href = window.DISCORD_INVITE;
  discord.target = '_blank';
} else {
  discord.hidden = true;
}

/* ---------- Experience slider ---------- */

const slider = document.getElementById('experience');
const sliderText = document.getElementById('experience-text');

function describeExperience() {
  const text = EXPERIENCE[slider.value];
  sliderText.textContent = text;
  slider.setAttribute('aria-valuetext', text);
}
slider.addEventListener('input', describeExperience);
describeExperience();

/* ---------- Contact methods ---------- */
// A method's field and its "preferred" radio stay inert until the method is picked,
// so nobody fills in a number that was never going to be sent.

const contactError = document.getElementById('contact-error');

function syncContacts() {
  let firstChecked = null;
  for (const pick of form.querySelectorAll('input[name="contact-methods"]')) {
    const row = pick.closest('.contact');
    const field = row.querySelector('input[type="email"], input[type="tel"], input[type="text"]');
    const pref = row.querySelector('input[name="contact-preferred"]');
    field.disabled = !pick.checked;
    pref.disabled = !pick.checked;
    if (!pick.checked) { field.value = ''; pref.checked = false; }
    else if (!firstChecked) firstChecked = pref;
  }
  // Always keep exactly one preference marked once anything is picked.
  const anyPreferred = form.querySelector('input[name="contact-preferred"]:checked');
  if (!anyPreferred && firstChecked) firstChecked.checked = true;
}

form.querySelectorAll('input[name="contact-methods"]')
  .forEach((el) => el.addEventListener('change', syncContacts));
syncContacts();

/* ---------- Payload ---------- */

/**
 * Object.fromEntries(new FormData(form)) keeps only the LAST value for a repeated
 * name, which would silently drop all but one chip in every multi-select. Collect
 * with getAll so groups arrive as arrays; the Worker joins them.
 */
function collect() {
  const data = new FormData(form);
  const payload = {};
  for (const key of new Set(data.keys())) {
    const values = data.getAll(key)
      .map((v) => (typeof v === 'string' ? v.trim() : v))
      .filter((v) => v !== '');
    if (!values.length) continue;
    payload[key] = values.length === 1 ? values[0] : values;
  }
  payload.experience = `${slider.value} — ${EXPERIENCE[slider.value]}`;
  return payload;
}

function say(message, isError) {
  status.textContent = message;
  status.classList.toggle('is-error', Boolean(isError));
}

/* ---------- Submit ---------- */

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  // The one hard requirement: some way to reach them.
  const picked = [...form.querySelectorAll('input[name="contact-methods"]:checked')];
  const usable = picked.filter((pick) => {
    const row = pick.closest('.contact');
    return row.querySelector('input[type="email"], input[type="tel"], input[type="text"]').value.trim();
  });

  if (!usable.length) {
    contactError.hidden = false;
    contactError.textContent = picked.length
      ? 'Please fill in the contact method you picked.'
      : 'Please pick at least one way for me to reach you.';
    document.querySelector('.contacts').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  contactError.hidden = true;

  const payload = collect();

  if (!ENDPOINT) {
    console.log('Onboarding payload (not sent — no endpoint configured):', payload);
    say('Stub: nothing was sent. Payload logged to the console.');
    return;
  }

  submit.disabled = true;
  say('Sending…');

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${response.status}`);
    }

    form.hidden = true;
    say('Got it. I will be in touch.');
  } catch (error) {
    submit.disabled = false;
    say(`${error.message} — email jordan@sortilege.online instead.`, true);
  }
});
