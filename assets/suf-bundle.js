// Bundle selection: reveal the seminar picker only when the chosen
// combination includes a seminar.
//
// The CE bundle is "any two of three", and one of the three is a weekend
// seminar. Asking which seminar when the buyer picked two certifications is
// noise; not asking when they did pick one loses the answer.
//
// PROGRESSIVE ENHANCEMENT, and the direction matters. The seminar field is
// rendered VISIBLE by sections/suf-cert.liquid and hidden here. With no
// JavaScript -- a blocked asset, an error in an unrelated module -- both
// fields simply show and the buyer can still say what they want. The other way
// round, a failed script would silently remove a choice from a $XXX purchase.
// Same principle as the [data-suf-motion] gate on the scroll accents.
//
// `disabled` as well as `hidden`, because hidden alone is not enough: a
// disabled control is not submitted, so switching from "Nutrition + Seminar"
// to "Nutrition + Soft Tissue" cannot leave a stale seminar riding along on an
// order that has no seminar in it.

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
