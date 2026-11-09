# Tarro POS 教程 · client tutorial hub

A static site for GitHub Pages: one link clients keep, eight short task videos, a printable QR sticker.
No build step, no dependencies — plain HTML/CSS/JS plus the MP4 files.

```
index.html          the hub page (cards, in-page player, deep links, optional analytics)
qr.html + qr.js     printable "扫码看教程" sticker generator (QR made in the browser, no external service)
videos/*.mp4        the tutorial videos (1080×1920, H.264, silent audio track until voiceover is added)
videos/*.jpg        poster images (title cards)
```

## 1. Publish on GitHub Pages (≈5 minutes)

1. Create a new **public** repository, e.g. `tarro-pos-guide` (public repos get Pages on the free plan).
2. Upload everything in this folder to the repository root (drag-and-drop in the GitHub web UI works; keep the `videos/` folder).
   Each video is well under GitHub's 100 MB per-file limit, so no Git LFS is needed.
3. Repository **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder = `/ (root)`. Save.
4. After a minute the site is live at `https://<your-github-username>.github.io/tarro-pos-guide/`.
   (Optional: Settings → Pages → Custom domain if you want something like `pos.tarro.com`.)

## 2. Before sending it to clients

- Open the link in **WeCom / WeChat on an iPhone and on an Android phone** — tap a card, confirm the video plays inline, close it, try "复制链接".
- Try a deep link: `…/index.html#refund` should scroll to and open the refund video. Deep-link ids:
  `#order` `#qty` `#checkout` `#quickpay` `#orders` `#refund` `#settings` `#help`
- Open `qr.html`, check the URL it shows, print the sticker (90 mm or 60 mm, 1 or 4 per page). CT can stick it on the POS during installation.

## 3. Updating

- **Adding voiceover:** export the narrated video with the *same file name* and replace it in `videos/`. Links and QR codes keep working.
  GitHub Pages caches for ~10 minutes; phones may cache longer — add `?v=2` to the `data-video` attribute in `index.html` if a client reports seeing the old file.
- **Adding a video:** copy one `<article class="card" …>` block in `index.html`, change the id, number, titles, file names and the 适用 line, and drop the MP4 + JPG into `videos/`.
- **Analytics (optional, off by default):** GitHub Pages has no stats of its own, so the page can report to one or both of these — paste the id into the settings block at the top of the `<script>` in `index.html`:
  - `TARRO_GA4_ID` — Google Analytics 4 measurement id (`G-…`): page views plus events `video_play`, `video_half`, `video_complete`, each with `video_id`, `src` and `client`. (To filter reports by `src`/`client`, register them as custom dimensions in GA4 → Admin → Custom definitions.)
  - `TARRO_CLARITY_ID` — Microsoft Clarity project id (free, includes session recordings so you can watch exactly what a client did on the page): custom tags `src`, `client`, `video` and events like `video_play_refund`, `video_complete_checkout`.
  - **Link conventions** make the numbers readable: the sticker already encodes `?src=qr`; for links you paste in WeCom use `?src=wecom&c=<client code>`, e.g. `https://…/index.html?src=wecom&c=golden-dragon#refund`. Then every play is attributed to a client and an entry path (sticker vs chat). The code is remembered for the session, and "复制链接" keeps it.
  - **Internal devices:** open `https://tarroys.github.io/pos-guide/?internal=1` once in each browser the team uses (WeCom, WeChat and Safari/Chrome keep separate storage). From then on every visit from that browser is reported as client `internal`, even when it opens a client's link; exclude `internal` in reports. `?internal=0` removes the tag. A plain link with no code is reported as client `unknown`, source `direct`.
  - Nothing is sent while both ids are empty.

## 4. Suggested rollout (from the onboarding talk track)

- End of the training call: send the hub link + the link to video 01 (`#order`). Not the whole set.
- Pin the hub link in each client's WeCom group announcement (群公告).
- Support replies with the specific deep link when a how-to question comes in (e.g. "退款怎么退？" → `…/index.html#refund`).
- Sticker on the terminal for staff who were not on the call.
