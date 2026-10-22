# Jake Lipohar Freediving

The site at [www.jakelipohar.ca](https://www.jakelipohar.ca). Pages, courses, and the map are plain HTML, CSS, and JavaScript. Blog posts are Markdown files. A small build turns them into the same blog pages the site already uses, so existing addresses such as `/blog/trapped-under-ice.html` stay the same.

The Vercel project is `jake-lipohar-preview`.

## Why Decap CMS

Jake writes posts in a form at `/admin`. Nothing to install, and no separate CMS account. [Decap CMS](https://decapcms.org/) (version 3.17.1) edits Markdown in this GitHub repo. Photos he uploads are committed next to the site. When he presses Publish, GitHub gets a commit on `main` and Vercel rebuilds the live site.

Decap is the smallest setup that does that on Vercel. TinaCMS wants Tina Cloud or a server of its own. Decap’s hosted “Turbo” service is another account to invite Jake to. Sveltia CMS can read this same `admin/config.yml` later if we ever want a different editor; the posts would not have to move. The GitHub sign-in on Vercel is a short function in `api/` because Netlify’s login service is not available here.

## For Jake: writing a post

1. Open [www.jakelipohar.ca/admin](https://www.jakelipohar.ca/admin).
2. Choose **Login with GitHub** and approve the prompt. Use the GitHub account that was invited to this repo.
3. Choose **Blog posts**, then **New Blog post**.
4. Fill in the title, the date, Freediving or Travel & hiking, a cover photo, a short excerpt, and the story.
5. In the story, the buttons add a heading, bold, italic, a link, a quote, a list, or a photo. The cover photo is the one on the home page and the blog list. Photos inside the story are added with the image button.
6. Press **Publish**.
7. Wait a couple of minutes, then refresh the site. The new post is on the blog, and if it is one of the three newest it is also under **Latest from the blog** on the home page.

A few things that are easy to miss:

- The web address is chosen from the title the first time you publish (`/blog/your-title.html`). Changing the title later does not change the address.
- **Freediving** posts show the “Want to try freediving?” box. **Travel & hiking** posts do not. Those two words are also the filters on the blog page.
- Tags are optional extra labels. They are not the filter.
- Leave “Link to the full story elsewhere” blank. It is only for the older shortened travel notes.
- To fix a post, open it, edit, and publish again. To take a post down, open it and delete it. The page disappears on the next rebuild.
- The FAQ card at the top of the blog is the FAQ on the home page. It is not a post, so it is not in the editor.

## Connect this repo to Vercel

The project `jake-lipohar-preview` should build from GitHub so a published post goes live on its own.

1. In Vercel, open the project `jake-lipohar-preview`.
2. Go to **Settings → Git**. Connect `bstyx/Jake-lipohar-site` if it is not connected. Production branch: `main`. Leave automatic deployments on.
3. **Settings → Build and Deployment**. These match `vercel.json` (the file wins if the dashboard disagrees):
   - Framework preset: **Other**
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Root directory: the repo root (leave it empty)
4. **Settings → Domains**. `www.jakelipohar.ca` is the production domain. If `jakelipohar.ca` is also attached, this repo redirects it to `www`. The editor login only works on `www`, because that host is the one registered with GitHub.
5. Deploy once from `main` before testing the editor. The first deploy creates the live `/admin` page.

`npm run build` reads `content/posts/*.md`, copies `site/` to `dist/`, and writes `blog.html`, `blog/<slug>.html`, and the home page teaser. Courses, the map, and the WhatsApp links are copied unchanged.

## GitHub OAuth App

Decap needs a GitHub OAuth App so the editor can commit as the person who is signed in. Create it while logged into the GitHub account that owns the repo: [github.com/settings/developers](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**.

| Field | Value |
|---|---|
| Application name | Jake Lipohar blog |
| Homepage URL | `https://www.jakelipohar.ca` |
| Application description | Blog editor for jakelipohar.ca |
| Authorization callback URL | `https://www.jakelipohar.ca/api/callback` |
| Enable Device Flow | leave unchecked |

Register the app, copy the **Client ID**, then **Generate a new client secret** and copy that too. The secret is shown only once.

In the Vercel project, **Settings → Environment Variables**, add these for **Production**:

| Name | Value |
|---|---|
| `GITHUB_CLIENT_ID` | the Client ID |
| `GITHUB_CLIENT_SECRET` | the client secret |

`SITE_URL` is optional. Set it only if the public site is not `https://www.jakelipohar.ca`. If you set it, use the same origin in `admin/config.yml` (`backend.base_url` and `site_domain`) and as the GitHub callback host. Do not commit the secret. `.env.example` lists the names only.

Redeploy production after saving the variables. Vercel does not apply new variables to a deployment that is already live.

`/api/auth` also accepts GitHub’s return trip, so a callback URL of `https://www.jakelipohar.ca/api/auth` works if it was registered that way. Use `/api/callback` for a new app. The callback in the OAuth App, `SITE_URL`, and `base_url` must all be the `www` host. A mismatch is the usual reason the login window closes without signing in.

## Invite Jake’s GitHub account

Jake signs in with GitHub, and GitHub only lets him publish if his account can write to this repo.

1. He creates a free GitHub account if he does not have one, and tells you the username.
2. On this repo, **Settings → Collaborators** → **Add people**. Invite that username with the **Write** role.
3. He accepts the invite from his email or from [github.com/bstyx/Jake-lipohar-site](https://github.com/bstyx/Jake-lipohar-site).
4. He opens [www.jakelipohar.ca/admin](https://www.jakelipohar.ca/admin), chooses **Login with GitHub**, and approves the “Jake Lipohar blog” app. The app asks for the `repo` scope so it can save posts.

Publishing commits straight to `main`. If `main` is set to require a pull request, the editor cannot publish and the post will not go live on its own. Write access plus a direct push to `main` is what makes “press Publish” update the website.

## What you still do by hand

After this repo is on GitHub, the owner still has to:

1. Connect Vercel project `jake-lipohar-preview` to `bstyx/Jake-lipohar-site` with the build settings above, and deploy `main`.
2. Create the GitHub OAuth App with callback `https://www.jakelipohar.ca/api/callback`.
3. Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to Vercel Production, then redeploy.
4. Confirm `www.jakelipohar.ca` is the production domain.
5. Invite Jake as a collaborator with Write access, and leave `main` open to direct pushes.
6. Ask Jake to sign in at `/admin` once and publish a draft, or open an existing post, so you can see the Vercel deployment go green.

No OAuth secret is in this repo, and the editor cannot log in until those variables exist on the deployed site.

## Pages

- `site/index.html`: hero, programs, upcoming courses, About Jake, gallery, map teaser, **Latest from the blog**, FAQ, contact form. The build rewrites only the blog teaser.
- `site/courses/*.html`: Discovery, Lap 1, Wave 1, Lap 2 / Wave 2, in-water coaching, remote coaching.
- `content/posts/*.md`: the 19 posts. The build writes `blog.html` and `blog/<slug>.html`.
- `site/map.html` plus `map.js`, `map-data.js`, and `world.js`: “Where I’ve dived”. Leaflet is in `site/vendor/`. No API key.
- `site/script.js`: booking links, the contact form, and the upcoming-course list.
- `site/img/blog/`: post photos, including ones uploaded from the editor.
- `admin/`: the editor. `api/auth.js` and `api/callback.js`: GitHub sign-in.

The nav still has Courses, Upcoming, About Jake, Blog, Map, FAQ, Message, and Book a call. Book a call opens WhatsApp to +1 613-818-9927 with a pre-filled message (`script.js` `CONFIG.BOOKING_URL`).

## Placeholders still to fill

Search for `REPLACE-ME`. Course dates live in `UPCOMING_COURSES` at the top of `site/script.js`. The script applies them on every page.

| What | Where | Currently |
|---|---|---|
| Booking link | `script.js` `CONFIG.BOOKING_URL` | WhatsApp chat to +1 613-818-9927. Not a placeholder. |
| Contact form endpoint | `script.js` `CONFIG.FORM_ENDPOINT` and the form `action` in `site/index.html` | `https://formspree.io/f/REPLACE-ME` |
| Upcoming course dates | `script.js` `UPCOMING_COURSES` | Empty on purpose. The site shows the Summer 2027 / early spring / @jake.freedives message. |
| Canonical URL | `site/index.html` `<head>` | `https://REPLACE-ME-DOMAIN.com/` |

Until the form endpoint is set, the form tells people to email or WhatsApp.

### Adding course dates

```js
const UPCOMING_COURSES = [
  { course: "Wave 1", date: "Sat 5 + Sun 6 Jun 2027", location: "Morrison's Quarry, Wakefield QC", price: "$550 / person", spots: 4 },
  { course: "Lap 1",  date: "Tue 1 + Thu 3 Jun 2027", location: "Pool, Ottawa", price: "$300 / person", spots: 0 }   // 0 = Full + waitlist
];
```

- `course` must be exactly `"Discovery"`, `"Lap 1"`, `"Wave 1"`, or `"Lap 2 / Wave 2"`.
- `spots`: 3–4 green, 1–2 amber “spots left”, 0 “Full” with a waitlist button. Max 4 students.
- With entries, the home page shows date cards and each course page shows its own dates. An empty list shows the “dates coming soon” message. In-water and remote coaching always say “By arrangement”.
- Change the season with `NEXT_SEASON` (currently `"Summer 2027"`). Remove entries after the course has passed.

## Map

No tile server. Land is drawn from `world.js`. To add a pin, edit `site/map-data.js` (name, country, lat/lng, description, `photo` in `site/img/map/` without the extension, `links`). A new country needs its Natural Earth name in the lookup in `site/map.js` when it differs (for example “USA” is “United States of America”).

## Local commands

```bash
npm install
npm test          # build, then check pages, the OAuth redirect, and the 19 posts
npm run serve     # http://localhost:4321
```

`/admin` loads from a local server and shows the GitHub login button when `admin/config.yml` is valid. Signing in still happens on the deployed site, because GitHub only returns to the registered callback.

Node 20 or newer.
