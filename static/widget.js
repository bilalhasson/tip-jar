/* Tip Jar — embeddable widget.
 *
 * Usage: drop one script tag on any page. The widget renders inline where the
 * tag sits. No framework required.
 *
 *   <script src="https://your-app.up.railway.app/widget.js"
 *           data-creator="Bilal"
 *           data-currency="gbp"
 *           data-amounts="3,5,10"></script>
 *
 * The backend base URL defaults to the origin this script was loaded from, so
 * data-api is only needed if your API lives on a different host.
 */
(function () {
  "use strict";

  var me = document.currentScript;
  if (!me) return;

  var creator = me.dataset.creator || "";
  var currency = (me.dataset.currency || "gbp").toLowerCase();
  var amounts = (me.dataset.amounts || "3,5,10")
    .split(",")
    .map(function (a) { return parseFloat(a.trim()); })
    .filter(function (a) { return !isNaN(a) && a > 0; });
  var api = (me.dataset.api || new URL(me.src).origin).replace(/\/$/, "");

  var SYMBOLS = { gbp: "£", usd: "$", eur: "€" };
  var symbol = SYMBOLS[currency] || "";

  function fmt(amount) {
    return symbol ? symbol + amount : amount + " " + currency.toUpperCase();
  }

  // Scoped styles — prefixed classes + a shadow-free but self-contained block so
  // it won't inherit or clash with the host page's CSS unexpectedly.
  var css =
    ".tipjar{all:initial;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;" +
    "display:inline-block;box-sizing:border-box;max-width:20rem;width:100%;" +
    "padding:1.25rem;border:1px solid #e5e7eb;border-radius:14px;" +
    "background:#fff;color:#111827;box-shadow:0 1px 3px rgba(0,0,0,.08)}" +
    ".tipjar *{box-sizing:border-box}" +
    ".tipjar__title{font-size:1.05rem;font-weight:600;margin:0 0 .75rem}" +
    ".tipjar__row{display:flex;gap:.5rem;margin-bottom:.6rem}" +
    ".tipjar__amt{flex:1;padding:.55rem 0;font-size:.95rem;font-weight:600;cursor:pointer;" +
    "border:1px solid #d1d5db;border-radius:9px;background:#f9fafb;color:#111827;transition:.12s}" +
    ".tipjar__amt:hover{border-color:#6366f1}" +
    ".tipjar__amt--on{background:#6366f1;border-color:#6366f1;color:#fff}" +
    ".tipjar__custom{width:100%;padding:.55rem .7rem;font-size:.95rem;margin-bottom:.6rem;" +
    "border:1px solid #d1d5db;border-radius:9px;color:#111827;background:#fff}" +
    ".tipjar__msg{width:100%;padding:.55rem .7rem;font-size:.95rem;margin-bottom:.6rem;" +
    "border:1px solid #d1d5db;border-radius:9px;color:#111827;background:#fff;" +
    "font-family:inherit;resize:vertical;min-height:2.4rem}" +
    ".tipjar__btn{width:100%;padding:.65rem;font-size:1rem;font-weight:600;cursor:pointer;" +
    "border:0;border-radius:9px;background:#111827;color:#fff;transition:.12s}" +
    ".tipjar__btn:hover{background:#374151}" +
    ".tipjar__btn:disabled{opacity:.6;cursor:default}" +
    ".tipjar :focus-visible{outline:2px solid #6366f1;outline-offset:2px}" +
    ".tipjar__err{color:#b91c1c;font-size:.85rem;margin:.5rem 0 0;min-height:1rem}";

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // Build the widget.
  var root = document.createElement("div");
  root.className = "tipjar";
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", creator ? "Tip " + creator : "Leave a tip");

  var title = document.createElement("div");
  title.className = "tipjar__title";
  title.textContent = creator ? "☕ Tip " + creator : "☕ Leave a tip";
  root.appendChild(title);

  var selected = amounts.length ? amounts[0] : null;

  var row = document.createElement("div");
  row.className = "tipjar__row";
  var buttons = [];
  amounts.forEach(function (amt) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "tipjar__amt" + (amt === selected ? " tipjar__amt--on" : "");
    b.textContent = fmt(amt);
    b.setAttribute("aria-pressed", amt === selected ? "true" : "false");
    b.addEventListener("click", function () {
      selected = amt;
      custom.value = "";
      buttons.forEach(function (btn) {
        btn.classList.remove("tipjar__amt--on");
        btn.setAttribute("aria-pressed", "false");
      });
      b.classList.add("tipjar__amt--on");
      b.setAttribute("aria-pressed", "true");
      clearErr();
    });
    buttons.push(b);
    row.appendChild(b);
  });
  root.appendChild(row);

  var custom = document.createElement("input");
  custom.className = "tipjar__custom";
  custom.type = "number";
  custom.min = "1";
  custom.step = "1";
  custom.placeholder = "Custom amount (" + (symbol || currency.toUpperCase()) + ")";
  custom.setAttribute("aria-label", "Custom tip amount");
  custom.addEventListener("input", function () {
    if (custom.value) {
      selected = null;
      buttons.forEach(function (btn) {
        btn.classList.remove("tipjar__amt--on");
        btn.setAttribute("aria-pressed", "false");
      });
    }
    clearErr();
  });
  root.appendChild(custom);

  var msg = document.createElement("textarea");
  msg.className = "tipjar__msg";
  msg.rows = 2;
  msg.maxLength = 200;
  msg.placeholder = "Say something (optional)";
  msg.setAttribute("aria-label", "Optional message");
  root.appendChild(msg);

  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tipjar__btn";
  btn.textContent = "Send tip";
  root.appendChild(btn);

  var err = document.createElement("p");
  err.className = "tipjar__err";
  err.setAttribute("aria-live", "polite");
  root.appendChild(err);

  function clearErr() { err.textContent = ""; }
  function showErr(msg) { err.textContent = msg; }

  function chosenAmount() {
    if (custom.value) {
      var v = parseFloat(custom.value);
      return isNaN(v) ? null : v;
    }
    return selected;
  }

  btn.addEventListener("click", function () {
    var amount = chosenAmount();
    if (!amount || amount <= 0) {
      showErr("Please choose or enter an amount.");
      return;
    }
    clearErr();
    btn.disabled = true;
    btn.textContent = "Redirecting…";

    fetch(api + "/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amount, creator: creator, message: msg.value.trim() }),
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (j) { throw new Error(j.detail || "Error"); });
        return r.json();
      })
      .then(function (data) {
        window.location.href = data.url;
      })
      .catch(function (e) {
        showErr(e.message || "Something went wrong. Please try again.");
        btn.disabled = false;
        btn.textContent = "Send tip";
      });
  });

  // Insert the widget right after the script tag.
  if (me.parentNode) {
    me.parentNode.insertBefore(root, me.nextSibling);
  } else {
    document.body.appendChild(root);
  }
})();
