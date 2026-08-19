// Sortilege onboarding form — submission handling.
//
// STUB: no delivery wired up yet. Set ENDPOINT to the chosen form-to-email
// service (Formspree / Web3Forms / a small worker) and this posts the whole
// form as JSON. Until then, submitting logs the payload and says so.

const ENDPOINT = null;

const form = document.getElementById('onboard');
const status = document.getElementById('status');

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = Object.fromEntries(new FormData(form).entries());

  if (!ENDPOINT) {
    console.log('Onboarding payload (not sent — no endpoint configured):', payload);
    status.textContent = 'Stub: nothing was sent. Payload logged to the console.';
    return;
  }

  status.textContent = 'Sending…';
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    form.hidden = true;
    status.hidden = false;
    status.textContent = 'Got it. I will be in touch.';
  } catch (error) {
    status.textContent = `That did not go through (${error.message}). Email jordan@sortilege.online instead.`;
  }
});
