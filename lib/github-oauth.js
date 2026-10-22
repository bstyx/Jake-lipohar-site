/**
 * GitHub OAuth proxy for Decap CMS.
 *
 * Decap opens /api/auth in a popup. We send the editor to GitHub, GitHub
 * returns to /api/callback, and we hand the access token back with the
 * postMessage handshake Decap expects:
 *   1. popup -> opener: "authorizing:github"
 *   2. opener -> popup: "authorizing:github" (origin must be base_url)
 *   3. popup -> opener: "authorization:github:success:{"token","provider"}"
 *
 * The callback URL registered on the GitHub OAuth App must be exactly
 * SITE_URL + "/api/callback" (default https://www.jakelipohar.ca/api/callback).
 * /api/auth also accepts ?code= so a callback pointed there still works.
 */

const SITE = (process.env.SITE_URL || "https://www.jakelipohar.ca").replace(/\/$/, "");
const REDIRECT_URI = `${SITE}/api/callback`;

function queryOf(req) {
  const fromUrl = new URL(req.url || "/", SITE).searchParams;
  const query = { ...req.query };
  for (const [key, value] of fromUrl.entries()) {
    if (query[key] == null || query[key] === "") query[key] = value;
  }
  return query;
}

function sendHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  res.end(html);
}

function missingConfigPage() {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Editor sign-in is not set up</title></head>
<body style="font-family:system-ui,sans-serif;padding:2rem;max-width:36rem;line-height:1.5">
<h1>Editor sign-in is not set up yet</h1>
<p>The blog editor needs a GitHub OAuth App. Add <code>GITHUB_CLIENT_ID</code> and <code>GITHUB_CLIENT_SECRET</code> to the Vercel project, then redeploy.</p>
<p>The GitHub callback URL must be <code>${REDIRECT_URI}</code>.</p>
</body></html>`;
}

function handshakePage(status, content) {
  const message = `authorization:github:${status}:${JSON.stringify(content)}`;
  const literal = JSON.stringify(message);
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Signing in…</title></head>
<body style="font-family:system-ui,sans-serif;padding:2rem">
<p>Signing you in to the blog editor…</p>
<script>
(function () {
  var message = ${literal};
  var sent = false;
  function finish(origin) {
    if (sent || !window.opener) return;
    sent = true;
    window.opener.postMessage(message, origin || "*");
    setTimeout(function () { window.close(); }, 400);
  }
  window.addEventListener("message", function (event) {
    if (typeof event.data === "string" && event.data.indexOf("authorizing:github") === 0) {
      finish(event.origin);
    }
  });
  if (window.opener) window.opener.postMessage("authorizing:github", "*");
  else document.body.innerHTML = "<p>You can close this window and go back to the editor.</p>";
})();
</script>
</body></html>`;
}

async function startLogin(req, res) {
  const query = queryOf(req);
  if (query.code) return finishLogin(req, res);

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId || !process.env.GITHUB_CLIENT_SECRET) {
    sendHtml(res, 500, missingConfigPage());
    return;
  }

  const scope = query.scope || "repo";
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", REDIRECT_URI);
  authorize.searchParams.set("scope", scope);
  authorize.searchParams.set("allow_signup", "true");
  res.statusCode = 302;
  res.setHeader("Location", authorize.toString());
  res.setHeader("Cache-Control", "no-store");
  res.end();
}

async function finishLogin(req, res) {
  const query = queryOf(req);
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    sendHtml(res, 500, missingConfigPage());
    return;
  }
  if (query.error) {
    sendHtml(res, 401, handshakePage("error", {
      message: query.error_description || query.error || "GitHub cancelled the login.",
    }));
    return;
  }
  if (!query.code) {
    sendHtml(res, 400, handshakePage("error", { message: "GitHub did not return a login code." }));
    return;
  }

  let result;
  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "jake-lipohar-site",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: query.code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    result = await response.json();
  } catch (error) {
    sendHtml(res, 502, handshakePage("error", { message: "Could not reach GitHub to finish signing in." }));
    return;
  }

  if (!result || !result.access_token) {
    sendHtml(res, 401, handshakePage("error", {
      message: (result && (result.error_description || result.error)) || "GitHub did not return an access token.",
    }));
    return;
  }

  sendHtml(res, 200, handshakePage("success", {
    token: result.access_token,
    provider: "github",
  }));
}

module.exports = { startLogin, finishLogin, SITE, REDIRECT_URI };
