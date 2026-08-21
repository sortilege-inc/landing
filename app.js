// Sortilege onboarding form — submission handling.
//
// Posts the whole form as JSON to the Cloudflare Worker in ./worker, which holds
// the Mailgun key and does the actual send. Set ENDPOINT to the URL that
// `wrangler deploy` prints. Until then, submitting logs the payload and says so.

const ENDPOINT = null;

const form = document.getElementById('onboard');
const status = document.getElementById('status');
const submit = form.querySelector('button[type="submit"]');

// Which printed QR this scan came from, e.g. .../?src=exchange-oct
// Rides along as a hidden field so we never have to ask.
const src = new URLSearchParams(location.search).get('src');
if (src) form.querySelector('input[name="src"]').value = src.slice(0, 60);

function say(message, isError) {
  status.textContent = message;
  status.classList.toggle('is-error', Boolean(isError));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = Object.fromEntries(new FormData(form).entries());

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
