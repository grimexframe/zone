# MORSTRIX | PORTAL

## Overview
A static personal/portfolio "portal" site (Russian-language UI) with a retro/pixel-art
CRT aesthetic. Built as plain HTML/CSS/JS — no framework, no build step.

- `index.html` — main portal (tabs: LAB / INFO), single-page with an in-page `<style>`
  block that overrides `css/style.css` for page-specific layout.
- `paint.html`, `tetris.html` — standalone mini-app pages linked from the portal.
- `js/` — `script.js` (main behavior), `paint.js`, `tetris.js`, `cosmic-bg.js`
  (background canvas animation), `views-counter.js`.
- `css/style.css` — shared styles (also used by paint/tetris pages).
- `assets/` — images, fonts.
- `backend/bot` and `backend/proxy` — separate Cloudflare Worker projects (own
  `package.json`/`wrangler.toml`). Not part of the static site's runtime and not
  invoked by it in this environment; only relevant if/when the user wants to work
  on the Cloudflare backends specifically.

## Running
No build step. Served as static files via the `Static Server` workflow
(`npx serve -l 5000 .`) on port 5000.

## Recent changes
- 2026-07-12: Moved the DONATE bar out of normal page flow so it's pinned to the
  bottom of the viewport (mirrors the fixed top panel) instead of appearing after
  the social-links/content sections. Edited the page-specific `<style>` block in
  `index.html` (`.journal-footer` + `.journal-wrapper` padding-bottom); no changes
  to `css/style.css` or JS.

## User preferences
(none recorded yet)
