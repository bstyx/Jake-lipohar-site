/* "Where I've dived": interactive map. Leaflet + free CARTO/OSM tiles, no API key. */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var PLACES = window.PLACES || [], HOME = window.HOME;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var small = function () { return window.innerWidth < 760; };
  var LABEL = { dive: "Dive site", hike: "Hike", travel: "Travel", home: "Home base" };
  var ICON = {
    dive: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M4 28c8-8 16-8 24 0s16 8 24 0M4 42c8-8 16-8 24 0s16 8 24 0" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
    hike: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M4 52 24 16l10 16 8-10 18 30z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>',
    travel: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" stroke-width="4"/><path d="M10 32h44M32 10c-12 14-12 30 0 44M32 10c12 14 12 30 0 44" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    home: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6l7 17 18 2-14 12 5 18-16-10-16 10 5-18L7 25l18-2z" fill="currentColor"/></svg>'
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  var all = PLACES.concat(HOME ? [HOME] : []);
  all.forEach(function (p) { p.slug = slug(p.name); });

  /* ---------- counters ---------- */
  var layer = "all";
  function visible(p) { return p.type === "home" || layer === "all" || p.type === layer; }
  function tween(el, to) {
    var from = parseInt(el.textContent, 10) || 0;
    cancelAnimationFrame(el.__raf); clearTimeout(el.__fin);
    if (reduce || from === to) { el.textContent = to; return; }
    var t0 = null;
    function step(t) {
      if (t0 === null) t0 = t;
      var k = Math.max(0, Math.min(1, (t - t0) / 600)), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (k < 1) el.__raf = requestAnimationFrame(step);
    }
    el.__raf = requestAnimationFrame(step);
    el.__fin = setTimeout(function () { cancelAnimationFrame(el.__raf); el.textContent = to; }, 900);
  }
  function updateStats() {
    var list = PLACES.filter(visible), c = {};
    list.forEach(function (p) { c[p.country] = 1; });
    tween($("#stat-places"), list.length);
    tween($("#stat-countries"), Object.keys(c).length);
  }

  /* ---------- card ---------- */
  var card = $("#place-card"), current = null;
  function openCard(p) {
    current = p;
    var photo = $("#pc-photo");
    photo.className = "pc-photo t-" + p.type + (p.photo ? "" : " nophoto");
    photo.innerHTML = p.photo
      ? '<img src="img/map/' + p.photo + '.jpg" alt="' + esc(p.name) + '" width="720" height="500">'
      : ICON[p.type];
    $("#pc-type").innerHTML = '<span class="dot t-' + p.type + '"></span>' + LABEL[p.type];
    $("#pc-name").textContent = p.name;
    $("#pc-where").textContent = [p.region, p.country].filter(Boolean).join(", ");
    $("#pc-desc").textContent = p.desc;
    $("#pc-links").innerHTML = (p.links || []).map(function (l, i) {
      var h = l.h;
      return '<a class="' + (i === 0 ? "btn btn-sm btn-primary" : "btn btn-sm btn-ghost") + '" href="' + esc(h) + '">' + esc(l.t) + ' &rarr;</a>';
    }).join("");
    card.hidden = false;
    card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop");
    var hint = $("#map-hint"); if (hint) hint.hidden = true;
    $$(".place-list button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-slug") === p.slug); });
    markers.forEach(function (m) { var el = m.getElement(); if (el) el.classList.toggle("is-active", m.__p === p); });
    if (history.replaceState) history.replaceState(null, "", "#" + p.slug);
  }
  function closeCard() {
    card.hidden = true; current = null;
    $$(".place-list button.on").forEach(function (b) { b.classList.remove("on"); });
    markers.forEach(function (m) { var el = m.getElement(); if (el) el.classList.remove("is-active"); });
    if (history.replaceState) history.replaceState(null, "", location.pathname);
  }
  $("#pc-close").addEventListener("click", function () { stopTour(); closeCard(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !card.hidden) { stopTour(); closeCard(); } });

  /* ---------- side list ---------- */
  var listEl = $("#place-list");
  function buildList() {
    var order = { dive: 0, hike: 1, travel: 2 }, html = "", last = "";
    PLACES.slice().sort(function (a, b) { return order[a.type] - order[b.type]; }).forEach(function (p) {
      if (p.type !== last) { last = p.type; html += '<li class="pl-head t-' + p.type + '" data-type="' + p.type + '">' + (p.type === "dive" ? "Dive sites" : p.type === "hike" ? "Hikes" : "Travel") + "</li>"; }
      html += '<li data-type="' + p.type + '"><button type="button" data-slug="' + p.slug + '"><span class="dot t-' + p.type + '"></span><span class="pl-name">' + esc(p.name) + '</span><span class="pl-country">' + esc(p.country) + "</span></button></li>";
    });
    listEl.innerHTML = html;
    listEl.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      stopTour();
      var p = all.filter(function (x) { return x.slug === b.getAttribute("data-slug"); })[0];
      if (p) select(p, true);
    });
  }
  buildList();
  function filterList() {
    $$("li", listEl).forEach(function (li) { li.hidden = !(layer === "all" || li.getAttribute("data-type") === layer); });
  }

  /* ---------- map ---------- */
  var map, markers = [], tourTimer = null, touring = false;
  var WORLD_VIEW = [[-42, -128], [62, 180]];
  function pinIcon(p, i) {
    var d = ((i * 0.37) % 2.6).toFixed(2);
    return L.divIcon({
      className: "pin-wrap",
      html: '<span class="pin t-' + p.type + '" style="--d:-' + d + 's"><b></b><i></i></span>',
      iconSize: [30, 30], iconAnchor: [15, 15]
    });
  }
  function select(p, fly) {
    openCard(p);
    if (!map) return;
    var z = p.type === "home" ? 6 : Math.max(map.getZoom(), small() ? 4.5 : 5.5);
    var target = [p.lat, p.lng];
    // on wide screens the card covers the lower-left, so nudge the focus point
    if (fly) {
      if (reduce) map.setView(target, z); else map.flyTo(target, z, { duration: 1.6 });
    }
    if (small()) { var m = $("#map"); if (m && m.getBoundingClientRect().top < 0) m.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); }
  }

  function init() {
    var loading = $("#map-loading");
    if (typeof L === "undefined") { if (loading) loading.textContent = "The map could not load. Browse the places in the list instead."; return; }
    map = L.map("map", {
      zoomControl: false, minZoom: 1, maxZoom: 9, zoomSnap: 0.5,
      zoomDelta: 0.5, wheelPxPerZoomLevel: 90, scrollWheelZoom: true, attributionControl: true, inertia: !reduce
    });
    map.fitBounds(WORLD_VIEW, { animate: false });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution('Land: <a href="https://www.naturalearthdata.com/">Natural Earth</a>');
    map.setMaxBounds([[-62, -200], [86, 200]]);
    // self-contained vector world: no tile server, no API key
    var visited = {};
    PLACES.forEach(function (p) { visited[({ USA: "United States of America", UK: "United Kingdom" })[p.country] || p.country] = 1; });
    var canvas = L.canvas({ padding: 0.4 });
    var land = L.geoJSON(window.WORLD, {
      renderer: canvas,
      style: function (f) {
        return visited[f.properties.n]
          ? { color: "#5eead4", weight: 0.9, opacity: 0.55, fillColor: "#117a85", fillOpacity: 0.62 }
          : { color: "#4f9bb8", weight: 0.6, opacity: 0.45, fillColor: "#124a68", fillOpacity: 0.85 };
      },
      onEachFeature: function (f, layer) {
        if (visited[f.properties.n]) {
          layer.on("mouseover", function () { layer.setStyle({ fillOpacity: 0.85 }); });
          layer.on("mouseout", function () { land.resetStyle(layer); });
        }
      }
    }).addTo(map);
    // faint graticule for the chart look
    var gOpt = { renderer: canvas, color: "#5eead4", weight: 0.5, opacity: 0.12, fill: false, interactive: false };
    for (var lat = -60; lat <= 80; lat += 20) L.polyline([[lat, -200], [lat, 200]], gOpt).addTo(map);
    for (var lng = -180; lng <= 180; lng += 30) L.polyline([[-62, lng], [86, lng]], gOpt).addTo(map);

    all.forEach(function (p, i) {
      var m = L.marker([p.lat, p.lng], {
        icon: pinIcon(p, i), title: p.name, alt: p.name, keyboard: true,
        riseOnHover: true, zIndexOffset: p.type === "home" ? 1000 : p.type === "dive" ? 500 : p.type === "hike" ? 200 : 0
      });
      m.__p = p;
      m.on("click", function () { stopTour(); select(p, true); });
      markers.push(m);
    });
    applyLayer();
    if (loading) loading.hidden = true;
    map.on("click", function () { stopTour(); });

    // deep link
    var h = location.hash.replace("#", "");
    if (h) { var hp = all.filter(function (x) { return x.slug === h; })[0]; if (hp) { openCard(hp); map.setView([hp.lat, hp.lng], hp.type === "home" ? 6 : 6, { animate: false }); } }
    setTimeout(function () { map.invalidateSize(); }, 300);
  }

  function applyLayer() {
    markers.forEach(function (m) {
      var show = visible(m.__p);
      if (show && !map.hasLayer(m)) m.addTo(map);
      if (!show && map.hasLayer(m)) map.removeLayer(m);
    });
    if (current && !visible(current)) closeCard();
    else if (current) markers.forEach(function (m) { var el = m.getElement(); if (el) el.classList.toggle("is-active", m.__p === current); });
  }

  /* ---------- filters ---------- */
  $$(".mchip").forEach(function (c) {
    c.addEventListener("click", function () {
      stopTour();
      layer = c.getAttribute("data-layer");
      $$(".mchip").forEach(function (x) { x.classList.toggle("active", x === c); });
      if (map) applyLayer();
      filterList(); updateStats();
      if (map) {
        var pts = PLACES.filter(visible).map(function (p) { return [p.lat, p.lng]; });
        if (layer === "all") map.flyToBounds(WORLD_VIEW, { duration: reduce ? 0 : 1.2 });
        else if (pts.length) map.flyToBounds(L.latLngBounds(pts).pad(0.25), { duration: reduce ? 0 : 1.2, maxZoom: 7 });
      }
    });
  });

  /* ---------- the dive tour ---------- */
  var tourBtn = $("#tour-btn");
  var tourOrder = ["Morrison's Quarry", "Cenote Angelita", "Cenote El Pit", "Laguna Kaan Luum", "Alchemy Freediving Center", "Y-40 The Deep Joy", "Ko Tao", "Apo Reef Natural Park", "Kayangan Lake", "Siquijor Freediving"];
  function stopTour() {
    if (!touring) return;
    touring = false; clearTimeout(tourTimer);
    tourBtn.innerHTML = "&#9654; Take the dive tour"; tourBtn.classList.remove("on");
  }
  function startTour() {
    var stops = tourOrder.map(function (n) { return PLACES.filter(function (p) { return p.name === n; })[0]; }).filter(Boolean);
    if (!stops.length || !map) return;
    // make sure dive sites are visible
    if (layer !== "all" && layer !== "dive") { $('.mchip[data-layer="dive"]').click(); }
    touring = true; tourBtn.innerHTML = "&#9632; Stop the tour"; tourBtn.classList.add("on");
    var i = 0;
    (function next() {
      if (!touring) return;
      var p = stops[i % stops.length]; i++;
      var z = 6.5;
      openCard(p);
      if (reduce) map.setView([p.lat, p.lng], z); else map.flyTo([p.lat, p.lng], z, { duration: 3 });
      tourTimer = setTimeout(next, reduce ? 4500 : 7500);
    })();
  }
  tourBtn.addEventListener("click", function () { touring ? stopTour() : startTour(); });

  updateStats();
  init();
  window.addEventListener("resize", function () { if (map) map.invalidateSize(); });
})();
