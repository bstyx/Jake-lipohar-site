import fs from "fs";
import path from "path";

const TYPES = {
  png: "png",
  jpg: "jpg",
  jpeg: "jpg",
  gif: "gif",
  webp: "webp",
};

// Pull data:image URLs out of a post and store them as real files.
// A pasted photo can otherwise land in the Markdown as millions of characters
// and the built page will not fit on screen.
export function extractDataImages(value, { slug, destDir, publicFolder = "/img/blog" } = {}) {
  const source = String(value ?? "");
  if (!source.includes("data:image")) return { value: source, count: 0 };

  let count = 0;
  let cursor = 0;
  let next = "";

  while (cursor < source.length) {
    const start = source.indexOf("data:image/", cursor);
    if (start < 0) {
      next += source.slice(cursor);
      break;
    }
    next += source.slice(cursor, start);
    const header = source.slice(start).match(/^data:image\/([a-zA-Z0-9.+-]+);base64,/);
    if (!header) {
      next += "data:image/";
      cursor = start + "data:image/".length;
      continue;
    }
    const payloadStart = start + header[0].length;
    const taken = takeBase64(source, payloadStart);
    const ext = TYPES[header[1].toLowerCase()];
    const bytes = ext ? decode(taken.payload) : null;
    if (!ext || !bytes || !bytes.length) {
      cursor = taken.end;
      continue;
    }
    count += 1;
    const name = `${slug}-pasted-${count}.${ext}`;
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, name), bytes);
    next += `${publicFolder}/${name}`;
    cursor = taken.end;
  }

  return { value: next, count };
}

function takeBase64(text, start) {
  let end = start;
  let payload = "";
  while (end < text.length) {
    const char = text[end];
    if (/[A-Za-z0-9+/=]/.test(char)) {
      payload += char;
      end += 1;
      continue;
    }
    if (!/\s/.test(char)) break;
    let look = end;
    while (look < text.length && /\s/.test(text[look])) look += 1;
    if (look < text.length && /[A-Za-z0-9+/=]/.test(text[look])) {
      end = look;
      continue;
    }
    break;
  }
  return { payload, end };
}

function decode(payload) {
  try {
    return Buffer.from(payload, "base64");
  } catch {
    return null;
  }
}
