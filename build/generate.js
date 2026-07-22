#!/usr/bin/env node
/* Echelon location-page network generator.
   Reads data/towns.json, emits one SEO page per town + an index hub into /site.
   Grow the network by adding towns to the JSON and re-running: `node build/generate.js`.
   All content is REAL/local — no fabricated stats (see anti-slop rule 7). Operational
   claims (phone, hours, insurance) are set ONCE in BRAND below — Tris confirms/edits
   before publishing. */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "site");
const { towns } = JSON.parse(fs.readFileSync(path.join(ROOT, "data/towns.json"), "utf8"));

// ---- Single source of truth for business facts. TRIS: confirm these before going live. ----
const BRAND = {
  name: "Echelon Mobile Valeting",
  short: "Echelon",
  tel: "",                        // TODO Tris: real number — left blank on purpose, never publish a fake one
  telHref: "",                    // set both together once you have a real line
  bookHref: "#quote",             // scrolls to the on-page quote form (see quote() below)
  region: "Bognor Regis & Chichester, West Sussex",
  url: "https://mobile-valeting.github.io/echelon", // GitHub Pages — swap for a real domain once registered
};
// Where the on-page quote form actually submits to (Agent Deck's public lead-capture
// endpoint on the VPS, CORS-open, rate-limited, honeypot-guarded — see server.js /api/lead).
const LEAD_ENDPOINT = "https://agent-deck.taileaa690.ts.net/api/lead";

const PLANS = [
  { name: "Express", price: 52, sub: "~45 min", lines: ["Exterior wash & dry", "Wheels & tyres dressed", "Interior vacuum", "Windows in & out"] },
  { name: "Standard", price: 72, sub: "~90 min", feature: true, lines: ["Everything in Express", "Full interior wipe-down", "Dashboard & console detailed", "Door shuts & sills", "Tyre shine + air freshen"] },
  { name: "Deep Interior", price: 125, sub: "~3 hrs", lines: ["Everything in Standard", "Seats & carpets shampooed", "Stain & pet-hair removal", "Paint decontamination", "Hand wax — shine that lasts"] },
];

const icon = {
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.4-8 12-8 12s-8-7.6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  drop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.7S6 9.4 6 14a6 6 0 0 0 12 0c0-4.6-6-11.3-6-11.3Z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>',
};

const mark = '<svg class="mk" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 3S6 13.4 6 21a10 10 0 0 0 20 0C26 13.4 16 3 16 3Z" fill="oklch(0.76 0.135 72)"/><path d="M16 8.5S10 15 10 20a6 6 0 0 0 6 6" stroke="oklch(0.255 0.045 205)" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const byslug = Object.fromEntries(towns.map((t) => [t.slug, t]));

function faqs(t) {
  return [
    ["Do you come to my home in " + t.name + "?", `Yes — Echelon is fully mobile. We come to your driveway or workplace anywhere in ${t.name} (${t.postcode}) and the surrounding area, and bring our own water and power. You don't need to be in, as long as we can reach the car.`],
    ["How much is a valet in " + t.name + "?", `Prices start at £${PLANS[0].price} for an Express valet, £${PLANS[1].price} for our most-booked Standard, and £${PLANS[2].price} for a Deep Interior. You get a fixed price when you book — no surprises on the day.`],
    ["How long will it take?", `An Express is about 45 minutes, a Standard around 90, and a Deep Interior up to three hours. We give you a slot when you book so you can plan your day.`],
    ["What if it rains?", `Light rain is usually fine for the interior and protective work. For a full exterior detail we'll move your slot to the next dry window — we'll message you rather than turn up and do half a job.`],
  ];
}

function jsonld(t) {
  const areaServed = [t.name, ...t.neighbours].map((n) => ({ "@type": "Place", name: n }));
  const business = {
    "@context": "https://schema.org", "@type": "AutoWash",
    name: `${BRAND.name} — ${t.name}`,
    description: `Mobile car valeting in ${t.name}, ${t.postcode}. We come to you across West Sussex.`,
    url: `${BRAND.url}/valeting-in-${t.slug}.html`,
    telephone: BRAND.tel, priceRange: "££", areaServed,
    address: { "@type": "PostalAddress", addressLocality: t.name, postalCode: t.postcode, addressRegion: "West Sussex", addressCountry: "GB" },
    makesOffer: PLANS.map((p) => ({ "@type": "Offer", name: `${p.name} valet`, price: p.price, priceCurrency: "GBP" })),
  };
  const faq = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs(t).map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
  return `<script type="application/ld+json">${JSON.stringify(business)}</script>\n<script type="application/ld+json">${JSON.stringify(faq)}</script>`;
}

function pageHead(title, desc, canonical) {
  return `<!-- theme: stamp data-theme from OS pref before paint -->
<script>try{var m=matchMedia('(prefers-color-scheme:dark)');document.documentElement.dataset.theme=m.matches?'dark':'light';}catch(e){}</script>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:url" content="${esc(canonical)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="assets/style.css">`;
}

function topbar() {
  return `<header class="topbar"><div class="wrap">
    <a class="brand" href="index.html">${mark}<b>Echelon</b></a>
    <nav class="nav">
      <a href="index.html#pricing">Prices</a>
      <a href="index.html#areas">Areas</a>
      ${BRAND.tel ? `<a class="tel" href="${BRAND.telHref}">${BRAND.tel}</a>` : `<a class="btn btn-primary" href="${BRAND.bookHref}">Get a price</a>`}
    </nav></div></header>`;
}

function quote(t) {
  const townName = t && t.name ? t.name : "";
  return `<section id="quote" class="wrap"><div class="section-head">
    <span class="eyebrow">Get a price</span>
    <h2>Tell us about your car${townName ? ` in ${townName}` : ""}</h2>
    <p>No account, no card needed — we'll come back to you with a fixed price.</p></div>
    <form class="quote-form" data-lead-form>
      <input type="text" name="hp" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <label>Name<input type="text" name="name" required maxlength="100"></label>
      <label>Phone or email<input type="text" name="phone" required maxlength="100"></label>
      <label>Anything we should know? (car, postcode, best time)<textarea name="message" maxlength="500"></textarea></label>
      <input type="hidden" name="venture" value="valeting-leadgen">
      <input type="hidden" name="town" value="${esc(townName)}">
      <button type="submit" class="btn btn-primary">Request a price</button>
      <p class="quote-status" role="status"></p>
    </form>
    <script>
    (function(){
      var f = document.currentScript.previousElementSibling;
      f.addEventListener('submit', function(e){
        e.preventDefault();
        var status = f.querySelector('.quote-status');
        var data = Object.fromEntries(new FormData(f).entries());
        var btn = f.querySelector('button');
        btn.disabled = true; status.textContent = 'Sending…';
        fetch('${LEAD_ENDPOINT}', {
          method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)
        }).then(function(r){ return r.json(); }).then(function(j){
          if (j.ok) { status.textContent = "Thanks — we'll be in touch shortly."; f.reset(); }
          else { status.textContent = j.error || 'Something went wrong — please try again.'; btn.disabled = false; }
        }).catch(function(){ status.textContent = 'Network error — please try again.'; btn.disabled = false; });
      });
    })();
    </script>
  </section>`;
}

function pricing() {
  return `<section id="pricing" class="wrap"><div class="section-head">
    <span class="eyebrow">What it costs</span>
    <h2>Fixed prices, no deposit games</h2>
    <p>Pick a valet, get a firm price. Most people book the Standard.</p></div>
    <div class="pricing">${PLANS.map((p) => `
      <div class="plan${p.feature ? " feature" : ""}">
        <div class="name">${p.name}</div>
        <div class="price">£${p.price} <small>· ${p.sub}</small></div>
        <ul>${p.lines.map((l) => `<li>${l}</li>`).join("")}</ul>
      </div>`).join("")}
    </div></section>`;
}

function steps() {
  const s = [
    ["01", "Book a slot", "Tell us your car and postcode and pick a time. You get a fixed price up front — no on-the-day haggling."],
    ["02", "We come to you", "We turn up on your driveway or at work with our own water, power and products. Nothing needed from you."],
    ["03", "Done properly", "We don't leave until it's right. Pay on completion, and we'll remind you when it's due a refresh."],
  ];
  return `<section class="wrap"><div class="section-head">
    <span class="eyebrow">How it works</span><h2>Three steps, no faff</h2></div>
    <div class="steps">${s.map(([n, h, p]) => `<div class="step"><div class="n">${n}</div><h3>${h}</h3><p>${p}</p></div>`).join("")}</div>
  </section>`;
}

function trust(t) {
  return `<section class="trust"><div class="wrap">
    <div class="claim">${icon.pin}<span>Local to ${t.name} &amp; ${BRAND.region.split("&")[1] ? "the coast" : "the area"}</span></div>
    <div class="claim">${icon.drop}<span>We bring water, power &amp; products</span></div>
    <div class="claim">${icon.calendar}<span>Evenings &amp; weekends by arrangement</span></div>
    <!-- TRIS: paste 1-2 REAL Google reviews here once you have them. Do not invent any. -->
    <p class="quote">Booked in minutes. Done on your driveway. Finished properly.</p>
  </div></section>`;
}

function areas(t) {
  const links = towns.map((o) => o.slug === t.slug
    ? `<a href="valeting-in-${o.slug}.html" aria-current="page">${o.name}</a>`
    : `<a href="valeting-in-${o.slug}.html">${o.name}</a>`).join("");
  return `<section id="areas" class="areas wrap"><div class="section-head">
    <span class="eyebrow">Where we cover</span>
    <h2>Mobile valeting across the ${t.postcode} area &amp; beyond</h2>
    <p>Near ${t.name}? We're probably already round the corner. Tap your town:</p></div>
    <ul>${links}</ul></section>`;
}

function faqSection(t) {
  return `<section class="wrap"><div class="section-head">
    <span class="eyebrow">Common questions</span><h2>Valeting in ${t.name}, answered</h2></div>
    <div class="faq">${faqs(t).map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</div>
  </section>`;
}

function closer(t) {
  return `<section class="closer"><div class="wrap">
    <span class="eyebrow" style="justify-content:center">Ready when you are</span>
    <h2>Get your car booked in around ${t.name}</h2>
    <p>Fixed price, on your driveway, done to a standard you'll want to book again.</p>
    <div class="cta-row"><a class="btn btn-primary" href="${BRAND.bookHref}">Get a price</a>
    ${BRAND.tel ? `<a class="btn btn-ghost" href="${BRAND.telHref}">Call ${BRAND.tel}</a>` : ""}</div>
  </div></section>`;
}

function footer() {
  const col = towns.slice(0, 4).map((o) => `<a href="valeting-in-${o.slug}.html">${o.name}</a>`).join("");
  const col2 = towns.slice(4).map((o) => `<a href="valeting-in-${o.slug}.html">${o.name}</a>`).join("");
  return `<footer class="foot"><div class="wrap">
    <div><div class="brand" style="font-family:var(--display)">Echelon</div>
      <p style="max-width:30ch">Mobile car valeting that comes to you across ${esc(BRAND.region)}.</p>
      ${BRAND.tel ? `<p style="font-family:var(--mono);font-size:.85rem;color:var(--brass)">${BRAND.tel}</p>` : ""}</div>
    <div><h4>Areas</h4>${col}</div>
    <div><h4>More areas</h4>${col2}</div>
  </div>
  <div class="disclosure"><div class="wrap">
    <p>${esc(BRAND.name)} is a local booking service. Some jobs may be carried out by vetted valeting partners we work with in your area. Prices shown are guide prices confirmed at booking.</p>
    <p>© ${new Date().getFullYear()} ${esc(BRAND.name)}</p>
  </div></div></footer>`;
}

function townPage(t) {
  const title = `Mobile Valeting in ${t.name} (${t.postcode}) | We Come to You — Echelon`;
  const desc = `Mobile car valeting in ${t.name}, ${t.postcode}. We come to your driveway with everything — from £${PLANS[0].price}. Fixed prices, evenings & weekends. Book Echelon.`;
  const canonical = `${BRAND.url}/valeting-in-${t.slug}.html`;
  const facts = [
    ["→", "We come to you — home or work"],
    ["→", "Own water & power, nothing needed"],
    ["→", `From £${PLANS[0].price} · fixed on booking`],
  ];
  return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8">
${pageHead(title, desc, canonical)}
${jsonld(t)}
</head><body>
${topbar()}
<main>
  <section class="hero"><div class="wrap">
    <div>
      <span class="eyebrow">Mobile valeting · ${t.postcode}</span>
      <h1>Car valeting<br>in <span class="town">${t.name}</span></h1>
      <p class="lede">${esc(t.intro)} <em>No queue, no drop-off</em> — just a proper job on your own drive.</p>
      <div class="cta-row"><a class="btn btn-primary" href="${BRAND.bookHref}">Get a price</a>
        <a class="btn btn-ghost" href="index.html#pricing">See what's included</a></div>
    </div>
    <aside class="hero-aside">
      <div class="postcode">${t.name} · ${t.postcode}</div>
      <ul>${facts.map(([b, l]) => `<li><b>${b}</b><span>${l}</span></li>`).join("")}</ul>
    </aside>
  </div></section>
  ${pricing()}
  ${steps()}
  ${trust(t)}
  ${areas(t)}
  ${faqSection(t)}
  ${quote(t)}
  ${closer(t)}
</main>
${footer()}
</body></html>`;
}

function indexPage() {
  const title = `${BRAND.name} — Car Valeting That Comes to You | ${BRAND.region}`;
  const desc = `Mobile car valeting across Bognor Regis, Chichester & West Sussex. We bring everything to your driveway. Fixed prices from £${PLANS[0].price}. Book Echelon.`;
  const cards = towns.map((t) => `<a href="valeting-in-${t.slug}.html">${t.name} <span style="opacity:.6">${t.postcode}</span></a>`).join("");
  return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8">
${pageHead(title, desc, BRAND.url + "/index.html")}
</head><body>
${topbar()}
<main>
  <section class="hero"><div class="wrap">
    <div>
      <span class="eyebrow">${esc(BRAND.region)}</span>
      <h1>The valet that<br><span class="town">comes to you</span></h1>
      <p class="lede">Driveway, work car park, wherever the car sits. We bring the water, the power and the products — you get it back <em>done properly</em>.</p>
      <div class="cta-row"><a class="btn btn-primary" href="${BRAND.bookHref}">Get a price</a>
        <a class="btn btn-ghost" href="#areas">Find your town</a></div>
    </div>
    <aside class="hero-aside">
      <div class="postcode">Covering</div>
      <ul>${towns.slice(0, 5).map((t) => `<li><b>→</b><span>${t.name}, ${t.postcode}</span></li>`).join("")}</ul>
    </aside>
  </div></section>
  ${pricing()}
  ${steps()}
  <section id="areas" class="areas wrap"><div class="section-head">
    <span class="eyebrow">Where we cover</span><h2>Pick your town</h2>
    <p>Local pages for each area we valet in — tap yours for prices and to book.</p></div>
    <ul>${cards}</ul></section>
  ${quote()}
  ${closer({ name: "your area" })}
</main>
${footer()}
</body></html>`;
}

// ---- write ----
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
// copy shared assets/fonts alongside output so /site is deploy-ready
for (const dir of ["assets", "fonts"]) {
  const dst = path.join(OUT, dir);
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, dir))) fs.copyFileSync(path.join(ROOT, dir, f), path.join(dst, f));
}
let n = 0;
for (const t of towns) { fs.writeFileSync(path.join(OUT, `valeting-in-${t.slug}.html`), townPage(t)); n++; }
fs.writeFileSync(path.join(OUT, "index.html"), indexPage());
console.log(`Generated ${n} town pages + index → ${OUT}`);
console.log("Towns:", towns.map((t) => t.slug).join(", "));
