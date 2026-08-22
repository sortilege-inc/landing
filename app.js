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
    const clean = value.trim().slice(0, 80);
    if (!clean) return;
    if (!chosen.some((c) => c.toLowerCase() === clean.toLowerCase())) chosen.push(clean);
    input.value = '';
    closeMenu();
    render();
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

  root.querySelector('.tagselect__box').addEventListener('click', () => input.focus());
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
