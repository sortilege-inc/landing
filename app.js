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
let lastSubmission = {};
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

  if (game.image) {
    const figure = document.createElement('div');
    figure.className = 'card__art';
    const img = document.createElement('img');
    img.src = game.image;
    img.alt = '';
    img.loading = 'lazy';
    img.width = 600;
    img.height = 400;
    figure.append(img);
    if (game.status) {
      const badge = document.createElement('span');
      badge.className = 'card__status';
      badge.textContent = game.status;
      figure.append(badge);
    }
    a.append(figure);
  }

  const body = document.createElement('div');
  body.className = 'card__body';

  const make = (cls, text, tag = 'p') => {
    const el = document.createElement(tag);
    el.className = cls;
    el.textContent = text; // textContent: game copy can never inject markup
    return el;
  };

  body.append(make('card__system', game.system), make('card__title', game.title));
  body.append(make('card__pitch', game.pitch));

  const meta = document.createElement('dl');
  meta.className = 'card__meta';
  for (const [term, value] of [['When', game.schedule], ['Length', game.length],
                               ['Where', game.format], ['Cost', game.price]]) {
    if (!value) continue;
    meta.append(make('card__term', term, 'dt'), make('card__value', value, 'dd'));
  }
  body.append(meta);
  body.append(make('card__cta', 'View on StartPlaying →', 'span'));

  a.append(body);
  cards.append(a);
}

/* ---------- Carousel controls ---------- */
// The track scrolls natively (touch, trackpad, keyboard); the buttons are an
// affordance on top of it, and hide themselves when everything already fits.

const carousel = document.querySelector('.carousel');
if (carousel && cards.children.length) {
  const prev = carousel.querySelector('.carousel__btn--prev');
  const next = carousel.querySelector('.carousel__btn--next');

  const step = () => cards.firstElementChild.getBoundingClientRect().width + 16;
  const scrollable = () => cards.scrollWidth - cards.clientWidth > 4;

  function sync() {
    const max = cards.scrollWidth - cards.clientWidth;
    carousel.classList.toggle('is-static', !scrollable());
    prev.disabled = cards.scrollLeft < 8;
    next.disabled = cards.scrollLeft > max - 8;
  }

  prev.addEventListener('click', () => cards.scrollBy({ left: -step(), behavior: 'smooth' }));
  next.addEventListener('click', () => cards.scrollBy({ left: step(), behavior: 'smooth' }));
  cards.addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync);
  sync();
}

const discord = document.getElementById('discord-link');
if (window.DISCORD_INVITE) {
  discord.href = window.DISCORD_INVITE;
  discord.target = '_blank';
} else {
  discord.hidden = true;
}

/* ---------- Tag pickers ---------- */
// Type to filter a seed list, click or Enter to add, and anything typed that is
// not on the list is accepted as-is. Each chosen tag gets its own hidden input
// under the same name, so FormData.getAll picks the whole set up as an array.

function createTagSelect(root) {
  const name = root.dataset.name;
  const options = window[root.dataset.source] || [];
  const chosen = [];

  // With no seed list this is strictly write-in: no menu, and no combobox
  // semantics to promise a popup that will never appear.
  const hasMenu = options.length > 0;

  root.innerHTML = `
    <div class="tagselect__box">
      <span class="tagselect__tags"></span>
      <input type="text" class="tagselect__input" autocomplete="off"
             ${hasMenu ? 'role="combobox" aria-expanded="false" aria-autocomplete="list"' : ''}>
    </div>
    ${hasMenu ? '<ul class="tagselect__menu" role="listbox" hidden></ul>' : ''}
    <span class="tagselect__values"></span>`;

  const tags = root.querySelector('.tagselect__tags');
  const input = root.querySelector('.tagselect__input');
  const menu = root.querySelector('.tagselect__menu');
  const values = root.querySelector('.tagselect__values');
  input.placeholder = root.dataset.placeholder || '';
  const labelledBy = root.getAttribute('aria-labelledby');
  if (labelledBy) input.setAttribute('aria-labelledby', labelledBy);

  let active = -1;

  function render() {
    tags.textContent = '';
    values.textContent = '';
    for (const value of chosen) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      const text = document.createElement('span');
      text.textContent = value;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'tag__x';
      remove.setAttribute('aria-label', `Remove ${value}`);
      remove.textContent = '×';
      remove.addEventListener('click', () => { drop(value); input.focus(); });
      tag.append(text, remove);
      tags.append(tag);

      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = name;
      hidden.value = value;
      values.append(hidden);
    }
  }

  function add(value) {
    let clean = value.trim().slice(0, 80);
    if (!clean) return;
    // Prefer the list's own spelling when the text matches an option.
    const canonical = options.find((o) => o.toLowerCase() === clean.toLowerCase());
    if (canonical) clean = canonical;
    if (!chosen.some((c) => c.toLowerCase() === clean.toLowerCase())) chosen.push(clean);
    input.value = '';
    render();
    // Reopen rather than close: picking one option is usually not the last one,
    // and the input keeps focus, so a plain focus handler would never re-fire.
    if (hasMenu && document.activeElement === input) openMenu();
    else closeMenu();
  }

  function drop(value) {
    const i = chosen.indexOf(value);
    if (i > -1) chosen.splice(i, 1);
    render();
  }

  function matches() {
    const q = input.value.trim().toLowerCase();
    return options
      .filter((o) => !chosen.some((c) => c.toLowerCase() === o.toLowerCase()))
      .filter((o) => !q || o.toLowerCase().includes(q))
      .slice(0, 8);
  }

  function openMenu() {
    if (!hasMenu) return;
    const list = matches();
    menu.textContent = '';
    active = -1;
    if (!list.length) return closeMenu();
    list.forEach((value) => {
      const li = document.createElement('li');
      li.role = 'option';
      li.className = 'tagselect__option';
      li.textContent = value;
      // mousedown, not click: blur would close the menu first.
      li.addEventListener('mousedown', (e) => { e.preventDefault(); add(value); });
      menu.append(li);
    });
    menu.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    if (!hasMenu) return;
    menu.hidden = true;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    [...menu.children].forEach((li) => li.classList.remove('is-active'));
  }

  function move(step) {
    if (!hasMenu) return;
    const items = [...menu.children];
    if (!items.length) return;
    items.forEach((li) => li.classList.remove('is-active'));
    active = (active + step + items.length) % items.length;
    items[active].classList.add('is-active');
    items[active].scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('input', openMenu);
  input.addEventListener('focus', openMenu);
  // focus does not re-fire on an already-focused input, so listen for the tap too.
  input.addEventListener('click', openMenu);
  input.addEventListener('blur', () => setTimeout(closeMenu, 120));

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); menu.hidden ? openMenu() : move(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
    else if (event.key === 'Enter') {
      event.preventDefault(); // never submit the form from this field
      const items = hasMenu ? [...menu.children] : [];
      add(active > -1 && items[active] ? items[active].textContent : input.value);
    } else if (event.key === 'Escape') { closeMenu(); }
    else if (event.key === 'Backspace' && !input.value && chosen.length) { drop(chosen[chosen.length - 1]); }
  });

  root.querySelector('.tagselect__box').addEventListener('click', () => { input.focus(); openMenu(); });
  render();
}

document.querySelectorAll('.tagselect').forEach(createTagSelect);

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
  const zone = payload.timezone;
  if (zone) {
    payload.timezone = `${zone} (${zoneLabel(zone)})`;
    Object.assign(payload, winnipegEquivalents(payload, zone));
  }
  return payload;
}

function say(message, isError) {
  status.textContent = message;
  status.classList.toggle('is-error', Boolean(isError));
}

/** The one hard requirement: some way to reach them. */
function contactIsUsable({ reveal = false } = {}) {
  const picked = [...form.querySelectorAll('input[name="contact-methods"]:checked')];
  const usable = picked.filter((pick) => {
    const row = pick.closest('.contact');
    return row.querySelector('input[type="email"], input[type="tel"], input[type="text"]').value.trim();
  });

  if (usable.length) { if (contactError) contactError.hidden = true; return true; }
  if (reveal && contactError) {
    contactError.hidden = false;
    contactError.textContent = picked.length
      ? 'Please fill in the contact method you picked.'
      : 'Please pick at least one way for me to reach you.';
  }
  return false;
}

/** Page one is the only gate: a name, a way to reach them, and how they'd play. */
function essentialsAreComplete({ reveal = false } = {}) {
  const error = document.getElementById('essentials-error');
  // Clear first: otherwise a message from the previous attempt stays on screen
  // after the reader has fixed that very thing.
  if (error) { error.hidden = true; error.textContent = ''; }
  const fail = (message, focus) => {
    if (reveal && error) {
      error.hidden = false;
      error.textContent = message;
      (focus || error).scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (focus && focus.focus) focus.focus({ preventScroll: true });
    }
    return false;
  };

  const name = form.querySelector('#name');
  if (!name.value.trim()) return fail('Please tell me what to call you.', name);
  if (!contactIsUsable({ reveal: true })) return false;

  const formats = [...form.querySelectorAll('input[name="format"]:checked')];
  if (!formats.length) return fail('Please say whether you would play online, in person, or both.');

  if (formats.some((f) => f.value === 'Online')) {
    const zone = form.querySelector('input[name="timezone"]');
    if (!zone || !zone.value) {
      return fail('Please pick your time zone so I can work out the overlap.',
                  document.getElementById('timezone'));
    }
  }

  if (error) error.hidden = true;
  return true;
}

/* ---------- Submit ---------- */

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!essentialsAreComplete({ reveal: true })) return;

  const payload = collect();
  lastSubmission = payload;

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

    showConfirmation();
  } catch (error) {
    submit.disabled = false;
    say(`${error.message} — email jordan@sortilege.online instead.`, true);
  }
});

/* ---------- Confirmation ---------- */
// Replaces the form with the open-games roster and the Discord invite. The
// newsletter tick lives here, past the submit, so it posts on its own.

function showConfirmation() {
  const done = document.getElementById('done');
  form.hidden = true;
  document.body.classList.remove('is-stepping');
  document.body.classList.add('is-done');
  if (!done) { say('Got it. I will be in touch.'); return; }

  done.hidden = false;
  done.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });

  const newsletter = done.querySelector('input[name="newsletter"]');
  const note = done.querySelector('#newsletter-note');
  if (!newsletter) return;

  newsletter.addEventListener('change', async () => {
    if (!newsletter.checked || !ENDPOINT) return;
    newsletter.disabled = true;
    if (note) note.textContent = 'Adding you…';
    try {
      await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: lastSubmission.name || '',
          email: lastSubmission.email || '',
          mobile: lastSubmission.mobile || '',
          discord: lastSubmission.discord || '',
          newsletter: 'Yes — sign me up',
          note: 'Newsletter opt-in, added after submitting.',
        }),
      });
      if (note) note.textContent = 'Done — you are on the list.';
    } catch {
      newsletter.disabled = false;
      newsletter.checked = false;
      if (note) note.textContent = 'That did not go through. Email jordan@sortilege.online and I will add you.';
    }
  });
}

/* ---------- Time zone ---------- */
// Only asked when someone plays online. The grid stays in their own local time;
// the Winnipeg equivalent is worked out here and carried in the payload, so
// Jordan never has to do the arithmetic and the player never sees it.

const HOME_ZONE = 'America/Winnipeg';

const SLOT_HOURS = {
  'Mornings': [8, 12],
  'Early Afternoons': [12, 15],
  'Late Afternoons': [15, 18],
  'Evenings': [18, 21],
  'After Dark': [21, 24],
};

const DAY_NAMES = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const DAY_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function zoneList() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone');
  } catch { /* fall through */ }
  return ['America/Winnipeg', 'America/Toronto', 'America/Vancouver', 'America/Chicago',
          'America/New_York', 'America/Denver', 'America/Los_Angeles', 'Europe/London',
          'Europe/Dublin', 'Europe/Berlin', 'Europe/Paris', 'Australia/Sydney',
          'Pacific/Auckland', 'Asia/Tokyo', 'Asia/Singapore', 'Asia/Kolkata'];
}

/** Minutes a zone is offset from UTC at a given instant. */
function zoneOffset(timeZone, date) {
  // Floor to a whole minute first: Date.UTC below has no seconds field, so any
  // seconds on the input would come back as a spurious minute of offset.
  const at = new Date(Math.floor(date.getTime() / 60000) * 60000);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(at).map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(+parts.year, parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
  return Math.round((asUTC - at.getTime()) / 60000);
}

function zoneLabel(timeZone) {
  try {
    const mins = zoneOffset(timeZone, new Date());
    const sign = mins < 0 ? '-' : '+';
    const abs = Math.abs(mins);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
  } catch {
    return '';
  }
}

/**
 * Converts each ticked day/slot into its Winnipeg equivalent.
 * Uses a date two weeks out as the reference, so the answer reflects the DST
 * rules likely in force when a game actually runs rather than today's.
 */
function winnipegEquivalents(payload, timeZone) {
  if (!timeZone || timeZone === HOME_ZONE) return {};

  const reference = new Date(Date.now() + 14 * 86400000);
  const out = {};

  for (const [key, dayKey] of Object.entries(DAY_NAMES).map(([k, v]) => [`avail-${k}`, k])) {
    const raw = payload[key];
    if (!raw) continue;
    const slots = Array.isArray(raw) ? raw : [raw];
    const spans = [];

    for (const slot of slots) {
      const hours = SLOT_HOURS[slot];
      if (!hours) continue;
      // Anchor the slot to the next occurrence of that weekday, in their zone.
      const anchor = new Date(reference);
      anchor.setUTCDate(anchor.getUTCDate() + ((DAY_INDEX[dayKey] - anchor.getUTCDay() + 7) % 7));

      const shift = (hour) => {
        const guess = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate(), hour, 0);
        // guess is that wall-clock time read as UTC; correct it into a real instant.
        const instant = new Date(guess - zoneOffset(timeZone, new Date(guess)) * 60000);
        const local = new Intl.DateTimeFormat('en-GB', {
          timeZone: HOME_ZONE, hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit',
        }).formatToParts(instant);
        const bits = Object.fromEntries(local.map((x) => [x.type, x.value]));
        return { day: bits.weekday, time: `${bits.hour}:${bits.minute}` };
      };

      const from = shift(hours[0]);
      // Hour 24 is valid here — Date.UTC rolls it to 00:00 the next day, which is
      // what "until midnight" means. A fractional hour would be truncated instead.
      const to = shift(hours[1]);
      const label = from.day === to.day
        ? `${from.day} ${from.time}–${to.time}`
        : `${from.day} ${from.time} – ${to.day} ${to.time}`;
      spans.push(`${slot} = ${label}`);
    }
    if (spans.length) out[`avail-${dayKey}-winnipeg`] = spans;
  }
  return out;
}

/** Single-select type-to-filter box, used for the time zone. */
function createCombo(root, options, { placeholder = '', name = '' } = {}) {
  root.innerHTML = `
    <input type="text" class="combo__input" role="combobox" aria-expanded="false"
           aria-autocomplete="list" autocomplete="off">
    <ul class="combo__menu" role="listbox" hidden></ul>
    <input type="hidden" name="${name}" class="combo__value">`;

  const input = root.querySelector('.combo__input');
  const menu = root.querySelector('.combo__menu');
  const value = root.querySelector('.combo__value');
  input.placeholder = placeholder;
  input.id = root.dataset.inputId || input.id;
  let active = -1;

  const pretty = (z) => `${z.replace(/_/g, ' ')}  ·  ${zoneLabel(z)}`;

  function close() {
    menu.hidden = true;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
  }

  function open() {
    const q = input.value.trim().toLowerCase().replace(/\s+/g, '');
    const list = options
      .filter((z) => !q || z.toLowerCase().replace(/[_/]/g, '').includes(q))
      .slice(0, 8);
    menu.textContent = '';
    active = -1;
    if (!list.length) return close();
    for (const zone of list) {
      const li = document.createElement('li');
      li.className = 'combo__option';
      li.role = 'option';
      li.textContent = pretty(zone);
      li.addEventListener('mousedown', (e) => { e.preventDefault(); choose(zone); });
      menu.append(li);
    }
    menu.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function choose(zone) {
    value.value = zone;
    input.value = pretty(zone);
    close();
    root.dispatchEvent(new CustomEvent('combo:change', { detail: zone, bubbles: true }));
  }

  function move(step) {
    const items = [...menu.children];
    if (!items.length) return;
    items.forEach((li) => li.classList.remove('is-active'));
    active = (active + step + items.length) % items.length;
    items[active].classList.add('is-active');
    items[active].scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('input', () => { value.value = ''; open(); });
  input.addEventListener('focus', open);
  input.addEventListener('click', open);
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); menu.hidden ? open() : move(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
    else if (event.key === 'Enter') {
      event.preventDefault();
      const items = [...menu.children];
      const pick = active > -1 ? items[active] : items[0];
      if (pick) choose(options.find((z) => pretty(z) === pick.textContent));
    } else if (event.key === 'Escape') close();
  });

  return { choose, get value() { return value.value; } };
}

function initTimeZone() {
  const field = document.getElementById('timezone-field');
  const host = document.getElementById('timezone-combo');
  if (!field || !host) return null;

  const combo = createCombo(host, zoneList(), {
    placeholder: 'Start typing a city…', name: 'timezone',
  });
  host.querySelector('.combo__input').id = 'timezone';

  // Pre-fill with the browser's own zone — right for most people, editable for the rest.
  try {
    const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (guess) combo.choose(guess);
  } catch { /* no guess is fine */ }

  const sync = () => {
    const online = [...form.querySelectorAll('input[name="format"]:checked')]
      .some((i) => i.value === 'Online');
    field.hidden = !online;
  };
  form.querySelectorAll('input[name="format"]').forEach((i) => i.addEventListener('change', sync));
  sync();
  return combo;
}

/* ---------- Availability drag-select ---------- */
// Tap toggles one cell; dragging paints across many. The first cell decides the
// direction — starting on an empty cell fills, starting on a filled one clears —
// which is what makes a wrong drag easy to undo by dragging back over it.

function initAvailabilityDrag() {
  const grid = document.querySelector('.avail');
  if (!grid || !window.PointerEvent) return;

  let painting = false;
  let mode = true;

  const cellAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('.avail__cell') : null;
  };

  const paint = (cell) => {
    if (!cell || !grid.contains(cell)) return;
    const input = cell.querySelector('input[type="checkbox"]');
    if (!input || input.checked === mode) return;
    input.checked = mode;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  grid.addEventListener('pointerdown', (event) => {
    const cell = event.target.closest('.avail__cell');
    if (!cell) return;
    const input = cell.querySelector('input[type="checkbox"]');
    if (!input) return;

    // We own the toggle from here. Without this the native label click fires too
    // and cancels out the change we just made.
    event.preventDefault();

    painting = true;
    mode = !input.checked;
    paint(cell);
    input.focus({ preventScroll: true });
    try { grid.setPointerCapture(event.pointerId); } catch { /* capture is a nicety */ }
  });

  grid.addEventListener('pointermove', (event) => {
    if (!painting) return;
    paint(cellAt(event.clientX, event.clientY));
  });

  const stop = (event) => {
    if (!painting) return;
    painting = false;
    try { grid.releasePointerCapture(event.pointerId); } catch { /* already released */ }
  };

  grid.addEventListener('pointerup', stop);
  grid.addEventListener('pointercancel', stop);
  grid.addEventListener('lostpointercapture', stop);

  grid.classList.add('is-draggable');
}

/* ---------- Step-through ---------- */
// Progressive enhancement: the markup is one long form and stays that way if
// this never runs. All fields remain in the DOM the whole time — steps only
// control visibility — so the payload is identical either way.

function initWizard() {
  const sections = [...form.querySelectorAll('.sec[data-step]')];
  if (!sections.length) return;

  const steps = [];
  for (const section of sections) {
    const n = Number(section.dataset.step);
    let step = steps.find((s) => s.n === n);
    if (!step) steps.push((step = { n, title: section.dataset.stepTitle || `Step ${n}`, sections: [] }));
    step.sections.push(section);
  }
  if (steps.length < 2) return;

  const submitBar = form.querySelector('.submit-bar');
  let current = 0;
  let furthest = 0;

  // Progress, above the first step.
  const progress = document.createElement('div');
  progress.className = 'wizard__progress';
  progress.innerHTML = `
    <div class="wizard__dots"></div>
    <div class="wizard__meta">
      <span class="wizard__title"></span>
      <span class="wizard__count"></span>
    </div>
    <div class="wizard__bar"><span></span></div>`;
  form.prepend(progress);

  const dots = progress.querySelector('.wizard__dots');
  steps.forEach((step, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'wizard__dot';
    dot.textContent = String(i + 1);
    dot.setAttribute('aria-label', `Step ${i + 1}: ${step.title}`);
    // Jumping back to somewhere already visited is safe; jumping ahead is not.
    dot.addEventListener('click', () => { if (i <= furthest) go(i); });
    dots.append(dot);
  });

  // Back / Next, below the current step.
  const nav = document.createElement('div');
  nav.className = 'wizard__nav';
  nav.innerHTML = `
    <button type="button" class="wizard__btn wizard__btn--back">&#8592; Back</button>
    <button type="button" class="wizard__btn wizard__btn--next">Next &#8594;</button>`;
  nav.querySelector('.wizard__btn--next').textContent = 'Next →';
  submitBar.before(nav);
  const back = nav.querySelector('.wizard__btn--back');
  const next = nav.querySelector('.wizard__btn--next');

  function validate(index) {
    const needs = steps[index].sections.some((s) => s.dataset.validate === 'essentials');
    return needs ? essentialsAreComplete({ reveal: true }) : true;
  }

  function go(index, { push = true } = {}) {
    current = Math.max(0, Math.min(index, steps.length - 1));
    furthest = Math.max(furthest, current);

    sections.forEach((s) => { s.hidden = Number(s.dataset.step) !== steps[current].n; });

    const last = current === steps.length - 1;
    const first = current === 0;
    // Page one can be submitted as-is; everything past it is optional, so the
    // submit bar shows on the first step and the last, and the Next button
    // says what continuing actually costs you.
    submitBar.hidden = !(first || last);
    next.hidden = last;
    next.textContent = first ? 'Continue to optional questions →' : 'Next →';
    back.hidden = first;
    back.disabled = first;
    nav.classList.toggle('is-single', first);

    progress.querySelector('.wizard__title').textContent = steps[current].title;
    progress.querySelector('.wizard__count').textContent = `Step ${current + 1} of ${steps.length}`;
    progress.querySelector('.wizard__bar span').style.width = `${((current + 1) / steps.length) * 100}%`;
    [...dots.children].forEach((dot, i) => {
      dot.classList.toggle('is-current', i === current);
      dot.classList.toggle('is-done', i < furthest || (i === furthest && i < current));
      dot.classList.toggle('is-reachable', i <= furthest);
      dot.setAttribute('aria-current', i === current ? 'step' : 'false');
    });

    // The hero is a welcome, not a header — it should not reappear above every
    // question and push the actual step off-screen.
    document.body.classList.toggle('is-stepping', current > 0);
    // The footer is worth showing where someone might want to leave or contact
    // Jordan directly — the opening and the end — but not between questions.
    document.body.classList.toggle('is-final-step', last);

    if (push && history.state?.step !== current) {
      history.pushState({ step: current }, '', location.pathname + location.search);
    }
    // Land on the question, not back up at the hero art.
    const top = progress.getBoundingClientRect().top + scrollY - 12;
    scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  next.addEventListener('click', () => { if (validate(current)) go(current + 1); });
  back.addEventListener('click', () => go(current - 1));

  // Android/browser back should step backwards, not leave the page.
  addEventListener('popstate', (event) => {
    if (typeof event.state?.step === 'number') go(event.state.step, { push: false });
  });

  // Enter anywhere but a textarea advances instead of submitting early.
  form.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    if (event.target.matches('textarea, .tagselect__input')) return;
    if (current < steps.length - 1) {
      event.preventDefault();
      if (validate(current)) go(current + 1);
    }
  });

  history.replaceState({ step: 0 }, '', location.pathname + location.search);
  go(0, { push: false });
  form.classList.add('is-wizard');
}

initTimeZone();
initAvailabilityDrag();
initWizard();
