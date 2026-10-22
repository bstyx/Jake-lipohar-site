import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import { Marked } from "marked";
import { extractDataImages } from "./inline-images.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = path.join(root, "site");
const postsDir = path.join(root, "content", "posts");
const distDir = path.join(root, "dist");

const BOOK = "https://wa.me/16138189927?text=Hi%20Jake%2C%20I%27d%20like%20to%20book%20a%20call%20about%20freediving";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const HOME_COUNT = 3;
const RELATED_COUNT = 3;

const COURSES = [
  ["courses/discovery.html", "Discovery"],
  ["courses/lap-1.html", "Lap 1"],
  ["courses/wave-1.html", "Wave 1"],
  ["courses/lap-2-wave-2.html", "Lap 2 / Wave 2"],
  ["courses/in-water-coaching.html", "In-water Coaching"],
  ["courses/remote-coaching.html", "Remote Coaching"],
];

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) throw new Error(`Unreadable date: ${value}`);
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function formatDisplay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function asList(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : String(value).split(",");
  return items.map((item) => String(item).trim()).filter(Boolean);
}

function publicPath(value) {
  if (!value) return "";
  let href = String(value).trim();
  if (/^[a-z]+:/i.test(href)) return href;
  if (href.startsWith("../")) href = href.slice(2);
  if (!href.startsWith("/")) href = `/${href.replace(/^\.\//, "")}`;
  return href;
}

function depthPath(href, depth) {
  if (!href || /^[a-z]+:/i.test(href) || href.startsWith("#") || href.startsWith("mailto:")) return href;
  if (href.startsWith("../") || href.startsWith("./")) return href;
  const clean = href.replace(/^\//, "");
  return `${depth ? "../" : ""}${clean}`;
}

function makeMarked(depth) {
  const marked = new Marked({ gfm: true, breaks: false });
  marked.use({
    tokenizer: {
      // Keep bare web addresses as links. Leave plain email addresses as text,
      // matching the existing posts.
      url(src) {
        const cap = this.rules.inline.url.exec(src);
        if (cap && cap[2] === "@") {
          return { type: "text", raw: cap[0], text: cap[0] };
        }
        return false;
      },
    },
    renderer: {
      image(token) {
        const src = depthPath(publicPath(token.href || ""), depth);
        const alt = esc(token.text || "");
        const caption = token.title ? `<figcaption>${esc(token.title)}</figcaption>` : "";
        return `<figure><img src="${esc(src)}" alt="${alt}" loading="lazy">${caption}</figure>`;
      },
      link(token) {
        const href = token.href || "";
        const text = this.parser.parseInline(token.tokens);
        const external = /^https?:/i.test(href);
        const url = external ? href : depthPath(publicPath(href), depth);
        const attrs = external ? ' rel="noopener" target="_blank"' : "";
        return `<a href="${esc(url)}"${attrs}>${text}</a>`;
      },
      paragraph(token) {
        const text = this.parser.parseInline(token.tokens);
        if (/^<figure>[\s\S]*<\/figure>$/.test(text)) return `${text}\n`;
        return `<p>${text}</p>\n`;
      },
    },
  });
  return marked;
}

function loadPosts() {
  const files = fs.readdirSync(postsDir).filter((name) => name.endsWith(".md")).sort();
  const posts = files.map((name) => {
    const slug = name.replace(/\.md$/, "");
    const raw = fs.readFileSync(path.join(postsDir, name), "utf8");
    const extracted = extractDataImages(raw, {
      slug,
      destDir: path.join(distDir, "img", "blog"),
    });
    if (extracted.count) {
      console.warn(`Saved ${extracted.count} pasted photo(s) from ${name} as files`);
    }
    let parsed;
    try {
      parsed = matter(extracted.value);
    } catch (error) {
      throw new Error(`${name} could not be read (${error.message})`);
    }
    const data = parsed.data || {};
    if (!data.title) throw new Error(`${name} is missing a title`);
    if (!data.category) throw new Error(`${name} is missing a category`);
    const date = isoDate(data.date);
    const body = parsed.content.trim();
    const excerpt = String(data.excerpt || "").trim() || excerptFrom(body);
    return {
      slug,
      title: String(data.title).trim(),
      date,
      displayDate: formatDisplay(date),
      category: String(data.category).trim(),
      tags: asList(data.tags),
      cover: publicPath(data.cover || "/hero.jpg"),
      excerpt,
      original: data.original ? String(data.original).trim() : "",
      body,
    };
  });
  const seen = new Set();
  for (const post of posts) {
    if (seen.has(post.slug)) throw new Error(`Duplicate post ${post.slug}`);
    seen.add(post.slug);
  }
  posts.sort((a, b) => (a.date === b.date ? a.title.localeCompare(b.title) : a.date < b.date ? 1 : -1));
  return posts;
}

function excerptFrom(markdown) {
  const plain = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^[#>*\-\d.]+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= 180) return plain;
  const cut = plain.slice(0, 180).replace(/\s+\S*$/, "");
  return `${cut}…`;
}

function card(post, depth, cta) {
  const href = depthPath(`/blog/${post.slug}.html`, depth);
  const img = depthPath(post.cover, depth);
  const label = cta || "Read more";
  return `<a class="post-card" href="${href}" data-tag="${esc(post.category)}">
  <div class="pc-img"><img src="${img}" alt="" loading="lazy"></div>
  <div class="pc-body"><span class="pc-meta">${esc(post.displayDate)} &middot; ${esc(post.category)}</span><h3>${esc(post.title)}</h3><p>${esc(post.excerpt)}</p><span class="card-link">${esc(label)} &rarr;</span></div>
</a>`;
}

function faqCard() {
  return `<a class="post-card" href="./#faq" data-tag="Freediving">
  <div class="pc-img"><img src="img/g-group.jpg" alt="" loading="lazy"></div>
  <div class="pc-body"><span class="pc-meta">October 13, 2026 &middot; Freediving</span><h3>Frequently Asked Questions</h3><p>Yes! If you can swim 200m nonstop and if your doctor says you have no medical contraindications, then you should definitely try freediving.</p><span class="card-link">Read the FAQ &rarr;</span></div>
</a>`;
}

function related(post, posts) {
  const rest = posts.filter((item) => item.slug !== post.slug);
  const same = rest.filter((item) => item.category === post.category);
  const other = rest.filter((item) => item.category !== post.category);
  return [...same, ...other].slice(0, RELATED_COUNT);
}

function home(depth) {
  return depth ? "../" : "./";
}

function nav(depth) {
  const p = depth ? "../" : "";
  const h = home(depth);
  const courseLinks = COURSES.map(([href, label]) => `<li><a href="${p}${href}">${label}</a></li>`).join("");
  return `<header class="nav scrolled solid" id="nav">
    <div class="wrap nav-inner">
      <a class="brand" href="${h}" aria-label="Jake Lipohar Freediving, home">
        <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><path d="M2 12c4-4 8-4 12 0s8 4 12 0M2 20c4-4 8-4 12 0s8 4 12 0" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>
        <span>Jake Lipohar</span>
      </a>
      <nav aria-label="Main" class="links" id="links">
        <div class="has-sub" id="courses-menu">
          <a href="${h}#programs" class="sub-toggle" id="courses-toggle" aria-haspopup="true" aria-expanded="false">Courses <span class="caret" aria-hidden="true"></span></a>
          <ul class="sub-menu" aria-label="Courses">${courseLinks}</ul>
        </div>
        <a href="${h}#upcoming">Upcoming</a>
        <a href="${h}#about">About Jake</a>
        <a href="${p}blog.html">Blog</a>
        <a href="${p}map.html">Map</a>
        <a href="${h}#faq">FAQ</a>
        <a href="${h}#contact">Message</a>
      </nav>
      <a class="btn btn-sm btn-primary nav-cta" href="${BOOK}" data-book target="_blank" rel="noopener">Book a call</a>
      <button class="burger" id="burger" aria-expanded="false" aria-controls="links" aria-label="Menu"><span></span><span></span></button>
    </div>
  </header>`;
}

function footer(depth) {
  const p = depth ? "../" : "";
  const h = home(depth);
  const courseLinks = COURSES.map(([href, label]) => `<a href="${p}${href}">${label}</a>`).join("");
  return `<footer class="footer">
    <div class="wrap">
      <div class="footer-cta">
        <h2>Here to make you the best freediver you can be.</h2>
        <a class="btn btn-primary btn-lg" href="${BOOK}" data-book target="_blank" rel="noopener">Book a call</a>
      </div>
      <div class="footer-links">
        <div><strong>Courses</strong>${courseLinks}</div>
        <div><strong>Explore</strong><a href="${h}#upcoming">Upcoming courses</a><a href="${h}#about">About Jake</a><a href="${p}blog.html">Blog</a><a href="${p}map.html">Where I've dived</a><a href="${h}#faq">FAQ</a><a href="${h}#contact">Send a message</a></div>
      </div>
      <div class="footer-row">
        <span>&copy; <span id="year">2026</span> Jake Lipohar</span>
        <span class="social">
          <a href="https://instagram.com/jake.freedives" data-instagram rel="noopener" target="_blank">Instagram</a>
          <a href="https://instagram.com/FreediveOttawa" rel="noopener" target="_blank">@FreediveOttawa</a>
          <a href="https://wa.me/16138189927" data-whatsapp rel="noopener" target="_blank">WhatsApp</a>
          <a href="mailto:jakelipohar@gmail.com" data-mailto>Email</a>
        </span>
      </div>
    </div>
  </footer>`;
}

function page({ title, description, image, depth, main }) {
  const p = depth ? "../" : "";
  const desc = esc(description);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${desc}">
  <meta name="theme-color" content="#04141f">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="${esc(image)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="${p}style.css">
</head>
<body class="subpage">
  <a class="skip" href="#main">Skip to content</a>

  ${nav(depth)}
  <main id="main">
${main}
  </main>

  ${footer(depth)}

  <script src="${p}script.js"></script>
</body>
</html>
`;
}

function renderPost(post, posts) {
  const marked = makeMarked(1);
  let body = marked.parse(post.body).trim();
  if (post.original) {
    body += `\n<p class="readmore"><a class="btn btn-ghost-dark" href="${esc(post.original)}" rel="noopener" target="_blank">Continue reading on jakelipohar.ca &rarr;</a></p>`;
  }
  const cta = post.category === "Freediving"
    ? `\n        <aside class="post-cta"><h2>Want to try freediving?</h2><p>Courses and coaching in Ottawa. Message Jake to ask about the next dates.</p><div class="cta-row"><a class="btn btn-primary" href="${BOOK}" data-book target="_blank" rel="noopener">Book a call</a><a class="btn btn-ghost" href="../courses/discovery.html">See the courses</a></div></aside>`
    : "";
  const more = related(post, posts).map((item) => card(item, 1)).join("");
  const tags = post.tags.length ? ` &middot; ${esc(post.tags.join(", "))}` : "";
  const main = `    <section class="page-hero">
      <div class="wrap">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="../blog.html">Blog</a> <span aria-hidden="true">/</span> <span>${esc(post.title)}</span></nav>
        <p class="eyebrow">${esc(post.displayDate)} &middot; ${esc(post.category)}${tags}</p>
        <h1>${esc(post.title)}</h1>
        
      </div>
    </section>
    <article class="section post light">
      <div class="wrap post-wrap">
        <div class="post-body">
${body}
        </div>${cta}
      </div>
    </article>
    <section class="section light more-posts">
      <div class="wrap">
        <h2 class="h-sm">More from the blog</h2>
        <div class="post-grid">${more}</div>
        <p class="center"><a class="btn btn-ghost-dark" href="../blog.html">All posts</a></p>
      </div>
    </section>`;
  return page({
    title: `${post.title} | Jake Lipohar Freediving`,
    description: post.excerpt,
    image: depthPath(post.cover, 1),
    depth: 1,
    main,
  });
}

function renderBlog(posts) {
  const cards = [faqCard(), ...posts.map((post) => card(post, 0))].join("\n");
  const main = `    <section class="page-hero">
      <div class="wrap">
        
        <p class="eyebrow">Blog</p>
        <h1>Stories from the water, and the trail</h1>
        <p class="lead">Freediving courses and lessons learned, plus Jake's hikes and travels. Everything here is from his own blog.</p>
      </div>
    </section>
    <section class="section blog-list light">
      <div class="wrap">
        <div class="filters" role="group" aria-label="Filter posts">
          <button class="chip-btn active" data-filter="all">All</button>
          <button class="chip-btn" data-filter="Freediving">Freediving</button>
          <button class="chip-btn" data-filter="Travel &amp; hiking">Travel &amp; hiking</button>
        </div>
        <div class="post-grid" id="post-grid">
${cards}
        </div>
      </div>
    </section>`;
  return page({
    title: "Blog | Jake Lipohar Freediving",
    description: "Stories from Jake Lipohar: becoming a freediving instructor, ice diving at Morrison's Quarry, beginner courses in Ottawa, and hikes and travel.",
    image: "hero.jpg",
    depth: 0,
    main,
  });
}

function patchHome(posts) {
  const indexPath = path.join(distDir, "index.html");
  const html = fs.readFileSync(indexPath, "utf8");
  const start = "<!-- blog-teaser:generated";
  const end = "<!-- /blog-teaser -->";
  const startAt = html.indexOf(start);
  const endAt = html.indexOf(end);
  if (startAt < 0 || endAt < startAt) throw new Error("index.html is missing the blog teaser markers");
  const cards = posts.slice(0, HOME_COUNT).map((post) => card(post, 0)).join("\n");
  const next = `${html.slice(0, startAt)}${start} -->\n${cards}\n${html.slice(endAt)}`;
  fs.writeFileSync(indexPath, next);
}

function copySite() {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.cpSync(siteDir, distDir, { recursive: true });
  fs.cpSync(path.join(root, "admin"), path.join(distDir, "admin"), { recursive: true });
}

function main() {
  copySite();
  const posts = loadPosts();
  const blogDir = path.join(distDir, "blog");
  fs.mkdirSync(blogDir, { recursive: true });
  for (const post of posts) {
    fs.writeFileSync(path.join(blogDir, `${post.slug}.html`), renderPost(post, posts));
  }
  fs.writeFileSync(path.join(distDir, "blog.html"), renderBlog(posts));
  patchHome(posts);
  console.log(`Built ${posts.length} posts -> ${path.relative(root, distDir)}`);
}

main();
