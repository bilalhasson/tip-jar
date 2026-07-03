/* Tip Jar — embeddable widget.
 *
 * One <script> tag renders a self-contained tip widget inside a Shadow DOM, so
 * the host page's CSS can never leak in or out. No framework, no build step.
 *
 *   <script src="https://tipjar.bilalhasson.com/widget.js"
 *           data-creator="Bilal" data-currency="gbp" data-amounts="3,5,10"
 *           data-placement="inline"        // inline | floating | modal
 *           data-position="bottom-right"   // floating only
 *           data-color="#6366f1" data-avatar="☕" data-theme="auto"></script>
 *
 * Backend base URL defaults to the origin this script was loaded from.
 *
 * Programmatic API (window.TipJar):
 *   TipJar.render(opts)  -> create an instance; returns a handle {open, close, el}
 *   TipJar.open(handle?) / TipJar.close(handle?)   (defaults to the latest instance)
 * Add data-auto="false" to the <script> to skip auto-init and drive it via the API.
 */
(function () {
  "use strict";

  var DEFAULTS = {
    creator: "", currency: "gbp", amounts: "3,5,10", api: "",
    placement: "inline", position: "bottom-right",
    color: "#6366f1", avatar: "☕", title: "", theme: "auto",
  };

  var SYMBOLS = { gbp: "£", usd: "$", eur: "€" };
  var FOCUSABLE = "button,[href],input,textarea,select,[tabindex]:not([tabindex='-1'])";

  function symbolFor(c) { return SYMBOLS[c] || c.toUpperCase() + " "; }

  function formatAmount(amt, currency) {
    try {
      return amt.toLocaleString(undefined, {
        style: "currency", currency: currency.toUpperCase(),
        minimumFractionDigits: Number.isInteger(amt) ? 0 : 2, maximumFractionDigits: 2,
      });
    } catch (e) { return symbolFor(currency) + amt; }
  }

  function isImageUrl(s) {
    return /^https?:\/\//.test(s) || /^\//.test(s) || /\.(png|jpe?g|gif|svg|webp)$/i.test(s);
  }

  function parseAmounts(raw) {
    var arr = Array.isArray(raw) ? raw : String(raw).split(",");
    arr = arr.map(function (a) { return parseFloat(a); }).filter(function (a) { return !isNaN(a) && a > 0; });
    return arr.length ? arr : [3, 5, 10];
  }

  // raw = a script element's dataset OR a plain options object. srcEl = the <script>.
  function readConfig(raw, srcEl) {
    raw = raw || {};
    var cfg = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      var v = raw[k];
      cfg[k] = v != null && v !== "" ? v : DEFAULTS[k];
    });
    cfg.currency = String(cfg.currency).toLowerCase();
    cfg.amounts = parseAmounts(cfg.amounts);
    var origin = srcEl && srcEl.src ? new URL(srcEl.src).origin : window.location.origin;
    cfg.api = String(cfg.api || origin).replace(/\/$/, "");
    cfg.title = cfg.title || (cfg.creator ? "Buy " + cfg.creator + " a coffee" : "Leave a tip");
    // Control options (not in DEFAULTS): carry through when present.
    if (raw.target != null && raw.target !== "") cfg.target = raw.target;
    if (raw.trigger != null) cfg.trigger = raw.trigger;
    return cfg;
  }

  function css() {
    return [
      ":host{all:initial;display:block}",
      ".tj-root{--tj-bg:#fff;--tj-fg:#111827;--tj-muted:#6b7280;--tj-border:#e5e7eb;--tj-field:#f9fafb;",
      "--tj-accent:#6366f1;--tj-accent-fg:#fff;",
      "font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--tj-fg)}",
      ".tj-root *{box-sizing:border-box}",
      "@media(prefers-color-scheme:dark){.tj-root[data-theme='auto']{--tj-bg:#1f2937;--tj-fg:#f9fafb;--tj-muted:#9ca3af;--tj-border:#374151;--tj-field:#111827}}",
      ".tj-root[data-theme='dark']{--tj-bg:#1f2937;--tj-fg:#f9fafb;--tj-muted:#9ca3af;--tj-border:#374151;--tj-field:#111827}",
      "[hidden]{display:none!important}",
      // card
      ".tj{display:inline-block;width:100%;max-width:21rem;background:var(--tj-bg);color:var(--tj-fg);",
      "border:1px solid var(--tj-border);border-radius:16px;padding:1.4rem;box-shadow:0 4px 20px rgba(0,0,0,.08)}",
      ".tj__head{display:flex;align-items:center;gap:.6rem;margin-bottom:1rem}",
      ".tj__avatar{width:2.25rem;height:2.25rem;border-radius:50%;flex:none;display:flex;align-items:center;",
      "justify-content:center;font-size:1.4rem;line-height:1;background:var(--tj-field);overflow:hidden}",
      ".tj__avatar img{width:100%;height:100%;object-fit:cover}",
      ".tj__title{font-size:1.05rem;font-weight:650;line-height:1.25}",
      ".tj__row{display:flex;gap:.5rem;margin-bottom:.7rem}",
      ".tj__amt{flex:1;padding:.6rem 0;font:inherit;font-weight:600;cursor:pointer;border:1.5px solid var(--tj-border);",
      "border-radius:11px;background:var(--tj-field);color:var(--tj-fg);transition:transform .08s,border-color .12s,background .12s}",
      ".tj__amt:hover{border-color:var(--tj-accent)}.tj__amt:active{transform:scale(.97)}",
      ".tj__amt--on{background:var(--tj-accent);border-color:var(--tj-accent);color:var(--tj-accent-fg)}",
      ".tj__field{width:100%;padding:.6rem .75rem;font:inherit;margin-bottom:.7rem;border:1.5px solid var(--tj-border);",
      "border-radius:11px;background:var(--tj-bg);color:var(--tj-fg)}",
      ".tj__msg{resize:vertical;min-height:2.6rem}",
      ".tj__btn{width:100%;padding:.75rem;font:inherit;font-weight:700;cursor:pointer;border:0;border-radius:11px;",
      "background:var(--tj-accent);color:var(--tj-accent-fg);display:flex;align-items:center;justify-content:center;gap:.5rem;",
      "transition:filter .12s,transform .08s}",
      ".tj__btn:hover{filter:brightness(1.07)}.tj__btn:active{transform:scale(.99)}.tj__btn:disabled{opacity:.7;cursor:default}",
      ".tj__spin{width:1rem;height:1rem;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:tj-spin .6s linear infinite}",
      "@keyframes tj-spin{to{transform:rotate(360deg)}}",
      ".tj ::placeholder{color:var(--tj-muted)}",
      ".tj-root :focus-visible{outline:2px solid var(--tj-accent);outline-offset:2px}",
      ".tj__err{color:#dc2626;font-size:.85rem;margin-top:.6rem;min-height:1rem}",
      // floating
      ".tj-float{position:fixed;z-index:2147483000}",
      ".tj-float--bottom-right{right:1.1rem;bottom:1.1rem;align-items:flex-end}",
      ".tj-float--bottom-left{left:1.1rem;bottom:1.1rem;align-items:flex-start}",
      ".tj-float{display:flex;flex-direction:column;gap:.6rem}",
      ".tj-fab{align-self:inherit;display:inline-flex;align-items:center;gap:.5rem;padding:.7rem 1.05rem;font:inherit;",
      "font-weight:700;cursor:pointer;border:0;border-radius:999px;background:var(--tj-accent);color:var(--tj-accent-fg);",
      "box-shadow:0 6px 20px rgba(0,0,0,.22);transition:transform .1s,filter .12s}",
      ".tj-fab:hover{filter:brightness(1.07)}.tj-fab:active{transform:scale(.96)}",
      ".tj-fab__ico{font-size:1.15rem;line-height:1}",
      ".tj-pop{align-self:inherit}",
      "@media(max-width:480px){.tj-fab__label{display:none}.tj-pop{position:fixed;left:0;right:0;bottom:0}",
      ".tj-pop .tj{max-width:none;border-radius:16px 16px 0 0}}",
      // modal
      ".tj-backdrop{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.55);",
      "display:flex;align-items:center;justify-content:center;padding:1rem}",
      ".tj-modal{position:relative}",
      ".tj-close{position:absolute;top:.5rem;right:.5rem;width:1.9rem;height:1.9rem;border:0;border-radius:50%;",
      "cursor:pointer;background:var(--tj-field);color:var(--tj-fg);font-size:1.1rem;line-height:1}",
      ".tj-trigger{display:inline-flex;align-items:center;gap:.5rem;padding:.6rem 1rem;font:inherit;font-weight:650;",
      "cursor:pointer;border:0;border-radius:11px;background:var(--tj-accent);color:var(--tj-accent-fg)}",
      ".tj-trigger:hover{filter:brightness(1.07)}",
      "@media(prefers-reduced-motion:reduce){.tj-root *{transition:none!important;animation:none!important}}",
    ].join("");
  }

  function avatarEl(cfg) {
    var a = document.createElement("div");
    a.className = "tj__avatar";
    if (isImageUrl(cfg.avatar)) {
      var img = document.createElement("img"); img.src = cfg.avatar; img.alt = ""; a.appendChild(img);
    } else { a.textContent = cfg.avatar; }
    return a;
  }

  // The shared tip card. Self-contained event wiring; used by every placement.
  function buildCard(cfg) {
    var root = document.createElement("div");
    root.className = "tj";
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", cfg.title);

    var head = document.createElement("div");
    head.className = "tj__head";
    var title = document.createElement("div");
    title.className = "tj__title";
    title.textContent = cfg.title;
    head.appendChild(avatarEl(cfg));
    head.appendChild(title);
    root.appendChild(head);

    var selected = cfg.amounts.length ? cfg.amounts[0] : null;
    var row = document.createElement("div");
    row.className = "tj__row";
    var buttons = [];
    cfg.amounts.forEach(function (amt) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "tj__amt" + (amt === selected ? " tj__amt--on" : "");
      b.textContent = formatAmount(amt, cfg.currency);
      b.setAttribute("aria-pressed", amt === selected ? "true" : "false");
      b.addEventListener("click", function () {
        selected = amt; custom.value = "";
        buttons.forEach(function (x) { x.classList.remove("tj__amt--on"); x.setAttribute("aria-pressed", "false"); });
        b.classList.add("tj__amt--on"); b.setAttribute("aria-pressed", "true");
        clearErr();
      });
      buttons.push(b); row.appendChild(b);
    });
    root.appendChild(row);

    var custom = document.createElement("input");
    custom.className = "tj__field"; custom.type = "number"; custom.min = "1"; custom.step = "any";
    custom.placeholder = "Other amount (" + symbolFor(cfg.currency).trim() + ")";
    custom.setAttribute("aria-label", "Custom tip amount");
    custom.addEventListener("input", function () {
      if (custom.value) {
        selected = null;
        buttons.forEach(function (x) { x.classList.remove("tj__amt--on"); x.setAttribute("aria-pressed", "false"); });
      }
      clearErr();
    });
    root.appendChild(custom);

    var msg = document.createElement("textarea");
    msg.className = "tj__field tj__msg"; msg.rows = 2; msg.maxLength = 200;
    msg.placeholder = "Leave a note (optional)";
    msg.setAttribute("aria-label", "Optional message");
    root.appendChild(msg);

    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "tj__btn";
    root.appendChild(btn);

    var err = document.createElement("p");
    err.className = "tj__err"; err.setAttribute("aria-live", "polite");
    root.appendChild(err);

    function clearErr() { err.textContent = ""; }
    function showErr(m) { err.textContent = m; }
    function setLoading(on) {
      btn.disabled = on; btn.textContent = "";
      if (on) { var s = document.createElement("span"); s.className = "tj__spin"; btn.appendChild(s); }
      var label = document.createElement("span");
      label.textContent = on ? "Redirecting…" : "Send tip";
      btn.appendChild(label);
    }
    setLoading(false);

    function chosenAmount() {
      if (custom.value) { var v = parseFloat(custom.value); return isNaN(v) ? null : v; }
      return selected;
    }

    btn.addEventListener("click", function () {
      var amount = chosenAmount();
      if (!amount || amount <= 0) { showErr("Please choose or enter an amount."); return; }
      clearErr(); setLoading(true);
      fetch(cfg.api + "/create-checkout-session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amount, creator: cfg.creator, message: msg.value.trim() }),
      })
        .then(function (r) { if (!r.ok) return r.json().then(function (j) { throw new Error(j.detail || "Error"); }); return r.json(); })
        .then(function (data) { window.location.href = data.url; })
        .catch(function (e) { showErr(e.message || "Something went wrong. Please try again."); setLoading(false); });
    });

    return root;
  }

  // Shadow host + themed root wrapper. Returns { host, root }.
  function createHost(cfg) {
    var host = document.createElement("div");
    host.className = "tipjar-host";
    var shadow = host.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    style.textContent = css();
    shadow.appendChild(style);
    var root = document.createElement("div");
    root.className = "tj-root";
    root.setAttribute("data-theme", cfg.theme);
    root.style.setProperty("--tj-accent", cfg.color);
    shadow.appendChild(root);
    return { host: host, root: root, shadow: shadow };
  }

  function insertAfter(node, ref) {
    if (ref && ref.parentNode) ref.parentNode.insertBefore(node, ref.nextSibling);
    else document.body.appendChild(node);
  }

  function noop() {}

  function mountInline(cfg, srcEl) {
    var h = createHost(cfg);
    h.root.appendChild(buildCard(cfg));
    var target = cfg.target && document.querySelector(cfg.target);
    if (target) target.appendChild(h.host); else insertAfter(h.host, srcEl);
    return { el: h.host, open: noop, close: noop };
  }

  function mountFloating(cfg) {
    var h = createHost(cfg);
    var wrap = document.createElement("div");
    wrap.className = "tj-float tj-float--" + (cfg.position === "bottom-left" ? "bottom-left" : "bottom-right");

    var pop = document.createElement("div");
    pop.className = "tj-pop"; pop.hidden = true;
    pop.appendChild(buildCard(cfg));

    var fab = document.createElement("button");
    fab.type = "button"; fab.className = "tj-fab"; fab.setAttribute("aria-expanded", "false");
    var ico = document.createElement("span"); ico.className = "tj-fab__ico";
    ico.textContent = isImageUrl(cfg.avatar) ? "☕" : cfg.avatar;
    var lab = document.createElement("span"); lab.className = "tj-fab__label"; lab.textContent = "Tip";
    fab.appendChild(ico); fab.appendChild(lab);

    var open = false;
    function set(v) {
      open = v == null ? !open : v;
      pop.hidden = !open;
      fab.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) { var f = pop.querySelector(FOCUSABLE); if (f) f.focus(); }
    }
    fab.addEventListener("click", function () { set(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && open) set(false); });
    document.addEventListener("click", function (e) {
      if (open && e.composedPath && e.composedPath().indexOf(wrap) === -1) set(false);
    });

    wrap.appendChild(pop); wrap.appendChild(fab);
    h.root.appendChild(wrap);
    document.body.appendChild(h.host);
    return { el: h.host, open: function () { set(true); }, close: function () { set(false); } };
  }

  function mountModal(cfg, srcEl) {
    var h = createHost(cfg);

    var backdrop = document.createElement("div");
    backdrop.className = "tj-backdrop"; backdrop.hidden = true;
    var modal = document.createElement("div");
    modal.className = "tj-modal";
    modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", cfg.title);
    modal.appendChild(buildCard(cfg));
    var close = document.createElement("button");
    close.type = "button"; close.className = "tj-close"; close.setAttribute("aria-label", "Close"); close.textContent = "✕";
    modal.appendChild(close);
    backdrop.appendChild(modal);
    h.root.appendChild(backdrop);

    var lastFocused = null;
    function open() {
      lastFocused = document.activeElement;
      backdrop.hidden = false;
      var f = modal.querySelector(FOCUSABLE); if (f) f.focus();
    }
    function shut() {
      backdrop.hidden = true;
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }
    close.addEventListener("click", shut);
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop) shut(); });
    document.addEventListener("keydown", function (e) {
      if (backdrop.hidden) return;
      if (e.key === "Escape") { shut(); return; }
      if (e.key === "Tab") {
        var items = modal.querySelectorAll(FOCUSABLE);
        if (!items.length) return;
        var first = items[0], last = items[items.length - 1], active = h.shadow.activeElement;
        if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      }
    });

    // Trigger button (unless caller opts out) so a data-placement="modal" script works standalone.
    if (cfg.trigger !== false && cfg.trigger !== "false") {
      var th = createHost(cfg);
      var trig = document.createElement("button");
      trig.type = "button"; trig.className = "tj-trigger";
      var ti = document.createElement("span"); ti.textContent = isImageUrl(cfg.avatar) ? "☕" : cfg.avatar;
      var tl = document.createElement("span"); tl.textContent = cfg.title;
      trig.appendChild(ti); trig.appendChild(tl);
      trig.addEventListener("click", open);
      th.root.appendChild(trig);
      var target = cfg.target && document.querySelector(cfg.target);
      if (target) target.appendChild(th.host); else insertAfter(th.host, srcEl);
    }

    document.body.appendChild(h.host);
    return { el: h.host, open: open, close: shut };
  }

  var instances = [];

  function create(raw, srcEl) {
    var cfg = readConfig(raw, srcEl);
    var handle;
    if (cfg.placement === "floating") handle = mountFloating(cfg);
    else if (cfg.placement === "modal") handle = mountModal(cfg, srcEl);
    else handle = mountInline(cfg, srcEl);
    instances.push(handle);
    return handle;
  }

  function latest() { return instances[instances.length - 1]; }

  window.TipJar = {
    render: function (opts) { return create(opts || {}, null); },
    open: function (h) { var t = h || latest(); if (t && t.open) t.open(); },
    close: function (h) { var t = h || latest(); if (t && t.close) t.close(); },
    instances: instances,
  };

  // Auto-init from the <script> tag unless opted out with data-auto="false".
  var me = document.currentScript;
  if (me && me.dataset.auto !== "false") create(me.dataset, me);
})();
