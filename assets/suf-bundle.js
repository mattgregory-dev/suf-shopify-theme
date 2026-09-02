// Bundle selection: reveal the seminar picker only when the chosen
// combination includes a seminar.
//
// THE DIRECTION MATTERS. The field is rendered VISIBLE by suf-cert.liquid and
// hidden here, so a blocked script leaves both fields showing and the buyer
// can still answer. The other way round, it would silently remove a choice
// from a $XXX purchase.
//
// `disabled` as well as `hidden`: a hidden control is still submitted, so
// switching combinations would leave a stale seminar on an order that has
// none.

function bindPicker(picks) {
  const form = picks.closest('form');
  if (!form) return;

  const field = form.querySelector('[data-suf-seminar-field]');
  if (!field) return;

  const seminar = field.querySelector('select');

  function sync() {
    const chosen = picks.options[picks.selectedIndex];
    // The attribute is written by Liquid as the string "true" or "false".
    const wanted = chosen ? chosen.dataset.seminar === 'true' : false;

    field.hidden = !wanted;
    if (seminar) seminar.disabled = !wanted;
  }

  sync();
  picks.addEventListener('change', sync);
}

document.querySelectorAll('[data-suf-picks]').forEach(bindPicker);
