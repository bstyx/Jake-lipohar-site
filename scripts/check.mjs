import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const require = createRequire(import.meta.url);
const { startLogin, finishLogin, REDIRECT_URI } = require("../lib/github-oauth.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const failures = [];

function fail(message) {
  failures.push(message);
  console.error("FAIL", message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function decode(value) {
  return String(value).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (all, ent) => {
    const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", middot: "·", rarr: "→", nbsp: " ", hellip: "…" };
    if (ent[0] === "#") {
      const code = ent[1].toLowerCase() === "x" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return Object.prototype.hasOwnProperty.call(named, ent) ? named[ent] : all;
  });
}

function read(file) {
  return fs.readFileSync(path.join(dist, file), "utf8");
}

const expectedTitles = [
  "Beginner Freediving Courses in Ottawa!",
  "Trapped Under Ice",
  "Beginner to Instructor: A Shallow Start",
  "Whakatane Whanau",
  "A Wee North Island Road Trip",
  "Colville Heights and Whitianga Nights",
  "Christmas in Coromandel",
  "Now arriving at AKL",
  "Fiji Gold: A cold beer or new besties?",
  "(W)interlude",
  "In Preparation",
  "GR.11 – Day 5",
  "GR.11 – Day 4",
  "GR.11 – Day 3",
  "GR.11 – Day 2",
  "GR.11 – Day 1",
  "GR.11 – Overview",
  "Indian Lookout Trail – Or, How I Learned to Love the Suck",
  "The Devil’s Thumb of Lake Louise",
];

const postFiles = fs.readdirSync(path.join(dist, "blog")).filter((name) => name.endsWith(".html")).sort();
assert(postFiles.length === 19, `expected 19 post pages, found ${postFiles.length}`);

const blog = read("blog.html");
const home = read("index.html");
for (const title of expectedTitles) {
  assert(blog.includes(title), `blog listing is missing ${title}`);
}
assert(blog.includes("Frequently Asked Questions"), "FAQ card missing from the blog listing");
assert(blog.includes('href="./#faq"'), "FAQ card should link to the home page FAQ");
assert(blog.includes('id="post-grid"'), "blog filter target missing");
assert(blog.includes('data-filter="Travel &amp; hiking"') || blog.includes('data-filter="Travel & hiking"'), "travel filter missing");
assert(home.includes("Beginner Freediving Courses in Ottawa!"), "home teaser missing the newest post");
assert(home.includes("Trapped Under Ice") && home.includes("Beginner to Instructor: A Shallow Start"), "home teaser is not the three newest posts");
assert(!home.includes("Whakatane Whanau"), "home teaser should only show the three newest posts");

const whatsapp = "https://wa.me/16138189927";
for (const file of ["index.html", "blog.html", "map.html", "courses/wave-1.html", "blog/trapped-under-ice.html"]) {
  assert(read(file).includes(whatsapp), `${file} is missing the WhatsApp link`);
  assert(read(file).includes("data-book"), `${file} is missing a Book a call button`);
}

const script = read("script.js");
assert(/const UPCOMING_COURSES = \[\s*\]/.test(script), "upcoming courses should still be the empty state");
assert(script.includes('NEXT_SEASON = "Summer 2027"'), "season headline changed");
assert(read("map.html").includes("leaflet"), "map page lost Leaflet");
assert(read("map.html").includes("map-data.js") && read("map.html").includes("world.js"), "map scripts missing");
assert(fs.existsSync(path.join(dist, "vendor/leaflet.js")), "Leaflet is not in the build");
assert(fs.existsSync(path.join(dist, "admin/index.html")), "admin page was not copied");
assert(fs.existsSync(path.join(dist, "admin/config.yml")), "admin config was not copied");

const config = yaml.load(fs.readFileSync(path.join(dist, "admin/config.yml"), "utf8"));
assert(config.backend.repo === "bstyx/jake-lipohar-site", "CMS repo is wrong");
assert(config.backend.base_url === "https://www.jakelipohar.ca", "CMS base_url is wrong");
assert(config.backend.auth_endpoint === "api/auth", "CMS auth endpoint is wrong");
assert(config.backend.branch === "main", "CMS branch is wrong");
assert(config.publish_mode === "simple", "posts should publish straight to main");
assert(config.media_folder === "site/img/blog", "uploads should be stored in the repo");
assert(config.collections[0].folder === "content/posts", "posts folder is wrong");
assert(config.collections[0].fields.some((field) => field.name === "body" && field.widget === "markdown"), "story field missing");
assert(config.collections[0].fields.some((field) => field.name === "cover" && field.widget === "image"), "cover field missing");

const ice = read("blog/trapped-under-ice.html");
assert(ice.includes("youtube.com/watch?v=455-CIgc7co"), "ice post lost the song link");
assert(ice.includes("post-cta"), "freediving posts should keep the course box");
assert((ice.match(/trapped-under-ice-\d\.jpg/g) || []).length === 7, "ice post lost photos");
assert(!read("blog/devils-thumb.html").includes("post-cta"), "travel posts should not gain the course box");
assert(read("blog/devils-thumb.html").includes("Continue reading on jakelipohar.ca"), "shortened posts lost the continue link");
assert(read("blog/devils-thumb.html").includes("THE BIG BEEHIVE"), "caption missing");
assert(read("blog/gr-11.html").includes("../blog/gr-11-day-1.html"), "overview lost the day links");
const coursePost = read("blog/beginner-freediving-courses-in-ottawa.html");
const courseBody = (coursePost.match(/<div class="post-body">([\s\S]*?)<\/div>/) || ["", ""])[1];
assert(courseBody.includes("jakelipohar@gmail.com"), "course post lost the email");
assert(!courseBody.includes("mailto:"), "plain email in the story was turned into a link");

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    end(body) { this.body = body || ""; this.ended = true; },
  };
}

const saved = {
  id: process.env.GITHUB_CLIENT_ID,
  secret: process.env.GITHUB_CLIENT_SECRET,
  site: process.env.SITE_URL,
};
delete process.env.GITHUB_CLIENT_ID;
delete process.env.GITHUB_CLIENT_SECRET;
delete process.env.SITE_URL;

const missing = mockRes();
await startLogin({ url: "/api/auth?scope=repo", query: {} }, missing);
assert(missing.statusCode === 500 && missing.body.includes("GITHUB_CLIENT_ID"), "missing OAuth config should explain itself");

process.env.GITHUB_CLIENT_ID = "test-client";
process.env.GITHUB_CLIENT_SECRET = "test-secret";
const login = mockRes();
await startLogin({ url: "/api/auth?provider=github&scope=repo&site_id=www.jakelipohar.ca", query: { scope: "repo", provider: "github" } }, login);
const location = login.headers.location || "";
assert(login.statusCode === 302, "login should redirect to GitHub");
assert(location.startsWith("https://github.com/login/oauth/authorize?"), "login redirect is not GitHub");
assert(location.includes("client_id=test-client"), "client id was not sent");
assert(location.includes(`redirect_uri=${encodeURIComponent(REDIRECT_URI)}`), `redirect_uri should be ${REDIRECT_URI}`);
assert(location.includes("scope=repo"), "scope should be repo");
assert(REDIRECT_URI === "https://www.jakelipohar.ca/api/callback", "default callback URL changed");

const denied = mockRes();
await finishLogin({ url: "/api/callback?error=access_denied&error_description=no", query: { error: "access_denied" } }, denied);
assert(denied.statusCode === 401 && denied.body.includes("authorizing:github") && denied.body.includes("authorization:github:error:"), "denied login should use the Decap handshake");

const nocode = mockRes();
await finishLogin({ url: "/api/callback", query: {} }, nocode);
assert(nocode.body.includes("authorization:github:error:"), "callback without a code should report an error to the editor");

if (saved.id == null) delete process.env.GITHUB_CLIENT_ID; else process.env.GITHUB_CLIENT_ID = saved.id;
if (saved.secret == null) delete process.env.GITHUB_CLIENT_SECRET; else process.env.GITHUB_CLIENT_SECRET = saved.secret;
if (saved.site == null) delete process.env.SITE_URL; else process.env.SITE_URL = saved.site;

const original = process.env.ORIGINAL_SITE || "/tmp/jake-site";
if (fs.existsSync(path.join(original, "blog.html"))) {
  compareToOriginal(original);
} else {
  console.log("Skipping byte-level compare; original site is not at", original);
}

function postBody(html) {
  const match = html.match(/<div class="post-body">([\s\S]*?)<\/div>/);
  return match ? match[1] : "";
}

function signature(html) {
  const inner = postBody(html);
  return {
    text: decode(inner.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(),
    imgs: [...inner.matchAll(/<img src="([^"]+)" alt="([^"]*)"/g)].map((m) => `${decode(m[1]).replace(/^\.\.\//, "/")}|${decode(m[2])}`),
    caps: [...inner.matchAll(/<figcaption>([\s\S]*?)<\/figcaption>/g)].map((m) => decode(m[1]).trim()),
    links: [...inner.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => `${decode(m[1])}|${decode(m[2].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim()}`),
    br: (inner.match(/<br\s*\/?>/g) || []).length,
    cta: html.includes("post-cta"),
    related: [...html.matchAll(/class="post-card" href="([^"]+)"/g)].map((m) => decode(m[1])),
  };
}

function cards(html) {
  const re = /<a class="post-card" href="([^"]+)" data-tag="([^"]+)">[\s\S]*?<img src="([^"]+)"[\s\S]*?<span class="pc-meta">([^<]+)<\/span><h3>([\s\S]*?)<\/h3><p>([\s\S]*?)<\/p><span class="card-link">([\s\S]*?)<\/span>/g;
  const out = [];
  let match;
  while ((match = re.exec(html))) {
    out.push([decode(match[1]), decode(match[2]), match[3].replace(/^\.\.\//, ""), decode(match[4]), decode(match[5]), decode(match[6]), decode(match[7].replace(/<[^>]+>/g, ""))].join(" | "));
  }
  return out;
}

function compareToOriginal(dir) {
  for (const file of fs.readdirSync(path.join(dir, "blog")).filter((name) => name.endsWith(".html"))) {
    const before = signature(fs.readFileSync(path.join(dir, "blog", file), "utf8"));
    const after = signature(fs.readFileSync(path.join(dist, "blog", file), "utf8"));
    assert(JSON.stringify(before) === JSON.stringify(after), `${file} does not match the current post`);
  }
  const sameCards = (a, b, label) => {
    const left = cards(a);
    const right = cards(b);
    assert(JSON.stringify(left) === JSON.stringify(right), `${label} cards changed (${left.length} vs ${right.length})`);
  };
  sameCards(fs.readFileSync(path.join(dir, "blog.html"), "utf8"), read("blog.html"), "blog");
  sameCards(fs.readFileSync(path.join(dir, "index.html"), "utf8"), read("index.html"), "home");

  function walk(rel) {
    const full = path.join(dir, rel);
    for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
      const child = path.join(rel, entry.name);
      if (entry.isDirectory()) walk(child);
      else unchanged.push(child);
    }
  }
  const unchanged = [];
  for (const name of ["courses", "img", "vendor"]) walk(name);
  for (const name of ["script.js", "map.html", "map.js", "map-data.js", "world.js", "hero.jpg"]) unchanged.push(name);
  for (const rel of unchanged) {
    const a = fs.readFileSync(path.join(dir, rel));
    const b = fs.readFileSync(path.join(dist, rel));
    assert(a.equals(b), `${rel} differs from the current site`);
  }
  const oldCss = fs.readFileSync(path.join(dir, "style.css"), "utf8");
  const newCss = read("style.css").replace(".post-body h3{font-size:1.35rem;margin:1.8rem 0 .75rem}\n.post-body h4{font-size:1.15rem;margin:1.5rem 0 .6rem;color:var(--ink);letter-spacing:-.02em}\n", "");
  assert(oldCss === newCss, "style.css changed outside the post heading rules");

  const strip = (html) => html.replace(/<div class="post-grid reveal">[\s\S]*?<p class="center">/, "<p class=\"center\">");
  assert(strip(fs.readFileSync(path.join(dir, "index.html"), "utf8")) === strip(read("index.html")), "home page changed outside the blog teaser");
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("Checks passed");
