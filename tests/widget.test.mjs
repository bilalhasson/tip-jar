// Headless widget tests (jsdom): placements + JS API. Run with `npm test`.
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const WIDGET = readFileSync(new URL("../static/widget.js", import.meta.url), "utf8");

function fresh(scriptAttrs, extraHtml) {
  const attrs = Object.entries(scriptAttrs || {}).map(([k, v]) => `${k}="${v}"`).join(" ");
  const dom = new JSDOM(
    `<!doctype html><body>${extraHtml || ""}<script src="https://tj.test/widget.js" ${attrs}></script></body>`,
    { runScripts: "outside-only", url: "https://host.example" }
  );
  const { window } = dom;
  window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ url: "https://checkout.stripe.com/x" }) });
  const scriptEl = window.document.querySelector("script[src*='widget.js']");
  Object.defineProperty(window.document, "currentScript", { value: scriptEl, configurable: true });
  window.eval(WIDGET);
  return window;
}

let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? "✓" : "✗"), name); };

// inline
let w = fresh({ "data-creator": "Bilal", "data-amounts": "3,5,10" });
let host = w.document.querySelector(".tipjar-host");
ok("inline: host + shadow root", !!host && !!host.shadowRoot);
ok("inline: card rendered", !!host.shadowRoot.querySelector(".tj"));
ok("inline: 3 amount buttons", host.shadowRoot.querySelectorAll(".tj__amt").length === 3);
ok("inline: £3 formatted", host.shadowRoot.querySelector(".tj__amt").textContent === "£3");
ok("inline: title from creator", host.shadowRoot.querySelector(".tj__title").textContent === "Buy Bilal a coffee");
ok("inline: TipJar API present", typeof w.TipJar?.render === "function");
ok("inline: 1 instance", w.TipJar.instances.length === 1);

// floating
w = fresh({ "data-creator": "Bilal", "data-placement": "floating", "data-position": "bottom-left" });
host = w.document.querySelector(".tipjar-host");
const fab = host.shadowRoot.querySelector(".tj-fab");
const pop = host.shadowRoot.querySelector(".tj-pop");
ok("floating: fab + hidden popover", !!fab && pop.hidden === true);
ok("floating: position class", !!host.shadowRoot.querySelector(".tj-float--bottom-left"));
fab.click();
ok("floating: opens", pop.hidden === false && fab.getAttribute("aria-expanded") === "true");
fab.click();
ok("floating: closes", pop.hidden === true);

// modal (+ trigger)
w = fresh({ "data-creator": "Bilal", "data-placement": "modal" });
const hosts = [...w.document.querySelectorAll(".tipjar-host")];
ok("modal: two hosts (modal + trigger)", hosts.length === 2);
let backdrop = null, trigger = null;
hosts.forEach((h) => {
  backdrop ||= h.shadowRoot.querySelector(".tj-backdrop");
  trigger ||= h.shadowRoot.querySelector(".tj-trigger");
});
ok("modal: backdrop hidden + dialog role", !!backdrop && backdrop.hidden === true && !!backdrop.querySelector("[role='dialog']"));
ok("modal: trigger + close button", !!trigger && !!backdrop.querySelector(".tj-close"));
trigger.click();
ok("modal: opens on trigger", backdrop.hidden === false);
backdrop.querySelector(".tj-close").click();
ok("modal: closes on ×", backdrop.hidden === true);

// API: data-auto=false, render/open/close, trigger:false
w = fresh({ "data-auto": "false" });
ok("auto=false: nothing auto-mounted", w.document.querySelectorAll(".tipjar-host").length === 0);
const handle = w.TipJar.render({ creator: "Ada", placement: "modal", trigger: false });
ok("api: render returns handle", typeof handle?.open === "function");
const b2 = w.document.querySelector(".tipjar-host").shadowRoot.querySelector(".tj-backdrop");
ok("api: modal hidden until open()", b2.hidden === true);
w.TipJar.open();
ok("api: open() shows modal", b2.hidden === false);
w.TipJar.close();
ok("api: close() hides modal", b2.hidden === true);

// multiple instances
w = fresh({ "data-auto": "false" });
w.TipJar.render({ creator: "A", placement: "floating" });
w.TipJar.render({ creator: "B", placement: "floating" });
ok("multi: two instances + hosts", w.TipJar.instances.length === 2 && w.document.querySelectorAll(".tipjar-host").length === 2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
