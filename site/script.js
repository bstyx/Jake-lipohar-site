/* ==========================================================
   EDIT ME: all placeholders live here (and are listed in README.md).
   ========================================================== */
const CONFIG = {
  BOOKING_URL:   "https://wa.me/16138189927?text=Hi%20Jake%2C%20I%27d%20like%20to%20book%20a%20call%20about%20freediving", // every "Book a call" button opens a WhatsApp chat with Jake (+1 613-818-9927). Swap in any booking link here if you add one.
  FORM_ENDPOINT: "https://formspree.io/f/REPLACE-ME",   // REPLACE-ME: Formspree form endpoint (until set, the form tells people to email/WhatsApp)
  CONTACT_EMAIL: "jakelipohar@gmail.com",               // real, from jakelipohar.ca
  WHATSAPP_URL:  "https://wa.me/16138189927",           // real: +1 613-818-9927, from jakelipohar.ca
  INSTAGRAM_URL: "https://instagram.com/jake.freedives" // real: @jake.freedives (also @FreediveOttawa)
};

/* UPCOMING COURSE DATES
   Leave this array EMPTY until real dates are confirmed: the site then shows a "courses will be announced" message
   with a link to Instagram. Add one object per scheduled course and the date cards appear on the home page and on
   the matching course page automatically. Remove an entry once the course has passed or is cancelled.
   - course:   exactly one of "Discovery", "Lap 1", "Wave 1", "Lap 2 / Wave 2"
   - date:     free text, e.g. "Sat 6 + Sun 7 Jun 2027"
   - location: free text
   - price:    free text
   - spots:    places left (max 4 per course). 1-2 shows "spots left" in amber, 0 shows "Full" + "Join the waitlist".
   Example (copy, uncomment and edit):
     { course: "Wave 1", date: "Sat 5 + Sun 6 Jun 2027", location: "Morrison's Quarry, Wakefield QC", price: "$550 / person", spots: 4 },
*/
const UPCOMING_COURSES = [
];

/* Headline of the "nothing scheduled yet" message */
const NEXT_SEASON = "Summer 2027";

/* ---------- no need to edit below ---------- */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var sub = document.body.classList.contains("subpage");   // course / blog pages live in a subfolder
  var ROOT = sub ? "../" : "";

  // Apply config
  $$("[data-book]").forEach(function (a) { a.href = CONFIG.BOOKING_URL; a.target = "_blank"; a.rel = "noopener"; });
  $$("[data-mailto]").forEach(function (a) {
    a.href = "mailto:" + CONFIG.CONTACT_EMAIL;
    if (/^Or email/.test(a.textContent)) a.textContent = "Or email " + CONFIG.CONTACT_EMAIL;
    else if (/@/.test(a.textContent)) a.textContent = CONFIG.CONTACT_EMAIL;
  });
  $$("[data-whatsapp]").forEach(function (a) { a.href = CONFIG.WHATSAPP_URL; });
  $$("[data-instagram]").forEach(function (a) { a.href = CONFIG.INSTAGRAM_URL; });
  var form = $("#contact-form"), status = $("#form-status"), btn = $("#submit-btn");
  if (form) form.action = CONFIG.FORM_ENDPOINT;
  $$("#year").forEach(function (y) { y.textContent = new Date().getFullYear(); });

  function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
  function contactHref(course) { return ROOT + "?interest=" + encodeURIComponent(course).replace(/%20/g, "+") + "#contact"; }

  // Upcoming courses. On the home page: all; on a course page (data-course): just that course.
  var list = $("#upcoming-list");
  if (list) {
    var only = list.getAttribute("data-course");
    var arrangement = list.hasAttribute("data-arrangement");   // coaching pages: no fixed dates, always by arrangement
    var items = UPCOMING_COURSES.filter(function (c) { return !only || c.course === only; });
    var section = list.closest(".upcoming");
    var msgHref = only ? contactHref(only) : "#contact";
    var bookBtn = '<a class="btn btn-primary" href="' + esc(CONFIG.BOOKING_URL) + '" data-book target="_blank" rel="noopener">Book a call</a>';
    var msgBtn = '<a class="btn btn-ghost" href="' + msgHref + '"' + (only ? ' data-interest="' + esc(only) + '"' : "") + '>Send a message</a>';
    var html = "";
    if (items.length) {
      html = items.map(function (c) {
        var full = c.spots <= 0;
        var low = !full && c.spots <= 2;
        var badge = full ? "Full" : (c.spots + (c.spots === 1 ? " spot left" : " spots left"));
        var cls = full ? "full" : (low ? "low" : "ok");
        var href = ROOT ? contactHref(c.course) : "#contact";
        var cta = full
          ? '<a class="btn btn-ghost btn-block" href="' + href + '" data-interest="' + esc(c.course) + '">Join the waitlist</a>'
          : '<a class="btn btn-primary btn-block" href="' + href + '" data-interest="' + esc(c.course) + '">Reserve / Ask about this</a>';
        return '<article class="up-card reveal">' +
          '<div class="up-top"><h3>' + esc(c.course) + '</h3><span class="badge ' + cls + '">' + badge + '</span></div>' +
          '<dl><div><dt>Date</dt><dd>' + esc(c.date) + '</dd></div><div><dt>Location</dt><dd>' + esc(c.location) + '</dd></div><div><dt>Price</dt><dd>' + esc(c.price) + '</dd></div></dl>' +
          cta + '</article>';
      }).join("");
    } else if (arrangement) {
      html = '<article class="up-card reveal"><div class="up-top"><h3>' + esc(only) + '</h3><span class="badge ok">By arrangement</span></div>' +
        '<dl><div><dt>Dates</dt><dd>Scheduled around your availability. Message me to set a time.</dd></div></dl>' +
        '<a class="btn btn-primary btn-block" href="' + contactHref(only) + '" data-interest="' + esc(only) + '">Message me</a></article>';
    } else {
      // Empty state: nothing announced yet. No made-up dates.
      if (section) section.classList.add("is-empty");
      html = '<div class="empty-up reveal">' +
        '<div class="eu-main">' +
          '<span class="eu-badge"><span class="eu-dot"></span>Dates coming soon</span>' +
          '<h3>' + esc(NEXT_SEASON) + ' courses</h3>' +
          '<p>' + (only ? esc(only) + ' dates for ' + esc(NEXT_SEASON) + ' have not been announced yet. ' : '') +
          'Courses will be announced in early spring. Be sure to follow <strong>@jake.freedives</strong> to be the first to know.</p>' +
          '<a class="btn btn-primary btn-lg" href="' + esc(CONFIG.INSTAGRAM_URL) + '" target="_blank" rel="noopener">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".6" fill="currentColor"/></svg>' +
            'Follow @jake.freedives</a>' +
        '</div>' +
        '<div class="eu-side">' +
          '<h4>Want to dive sooner?</h4>' +
          '<p>Book a private session or small group on a date that suits you.</p>' +
          '<div class="eu-actions">' + bookBtn + msgBtn + '</div>' +
        '</div></div>';
    }
    list.insertAdjacentHTML("beforeend", html);
    
  }

  // Preselect "interested in": from a link click on this page, or ?interest= in the URL
  var sel = $("#interest");
  function pick(v) {
    if (!sel || !v) return;
    $$("option", sel).forEach(function (o) { if (o.textContent === v) sel.value = o.value || o.textContent; });
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-interest]");
    if (a) pick(a.getAttribute("data-interest"));
  });
  var m = /[?&]interest=([^&#]+)/.exec(location.search);
  if (m) pick(decodeURIComponent(m[1].replace(/\+/g, " ")));

  // Mobile menu + Courses dropdown
  var burger = $("#burger"), nav = $("#nav");
  function closeMenu() { nav.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); }
  burger.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });
  $$("#links a").forEach(function (a) { a.addEventListener("click", closeMenu); });
  var cm = $("#courses-menu"), ct = $("#courses-toggle");
  var wide = window.matchMedia("(min-width:900px)");
  function setSub(open) { cm.classList.toggle("open", open); ct.setAttribute("aria-expanded", open ? "true" : "false"); }
  if (cm && ct) {
    ct.addEventListener("click", function (e) {            // first tap/click opens the menu on desktop; second goes to #programs
      if (wide.matches && !cm.classList.contains("open")) { e.preventDefault(); setSub(true); }
    });
    cm.addEventListener("mouseenter", function () { if (wide.matches) setSub(true); });
    cm.addEventListener("mouseleave", function () { setSub(false); });
    document.addEventListener("click", function (e) { if (!cm.contains(e.target)) setSub(false); });
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeMenu(); if (cm) setSub(false); } });

  // Nav state on scroll
  function onScroll() { nav.classList.toggle("scrolled", sub || window.scrollY > 20); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  // Blog filters
  var chips = $$(".chip-btn");
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      chips.forEach(function (x) { x.classList.toggle("active", x === c); });
      var f = c.getAttribute("data-filter");
      $$("#post-grid .post-card").forEach(function (p) { p.hidden = !(f === "all" || p.getAttribute("data-tag") === f); });
    });
  });

  // Scroll reveal
  var reveals = $$(".reveal");
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.classList.add("js-anim");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el, i) { el.style.transitionDelay = ((i % 4) * 70) + "ms"; io.observe(el); });
  }

  // Contact form: submit via fetch, fall back to normal post
  if (form) form.addEventListener("submit", function (e) {
    if (/REPLACE-ME/.test(CONFIG.FORM_ENDPOINT)) {
      e.preventDefault();
      status.className = "form-status err";
      status.innerHTML = 'The form is not connected yet. Please <a href="mailto:' + CONFIG.CONTACT_EMAIL + '">email me</a> or <a href="' + CONFIG.WHATSAPP_URL + '">message me on WhatsApp</a>.';
      return;
    }
    if (!window.fetch) return;
    e.preventDefault();
    btn.disabled = true; btn.textContent = "Sending…";
    fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error();
        form.reset();
        status.className = "form-status ok";
        status.textContent = "Thanks! Your message is on its way. I'll get back to you soon.";
      })
      .catch(function () {
        status.className = "form-status err";
        status.innerHTML = 'Something went wrong. Please <a href="mailto:' + CONFIG.CONTACT_EMAIL + '">email me directly</a>.';
      })
      .then(function () { btn.disabled = false; btn.textContent = "Send message"; });
  });
})();
