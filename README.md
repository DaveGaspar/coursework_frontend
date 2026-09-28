# Sports Live

A website for watching football matches live and buying match tickets, in English and Armenian.
It uses plain HTML, CSS and JavaScript: no frameworks and no build step. Match data is real and comes
from public sports APIs. Accounts, tickets and admin changes are saved in the browser until the
backend is ready.

## How to run it

The site must be opened through a small local web server. Double-clicking an `.html` file does not
work, because browsers block JavaScript modules on `file://` pages. Pick whichever option fits the
computer you are on.

### Option 1: Windows, nothing to install (easiest)

1. Download or copy the project folder to the computer.
2. Open the folder and double-click **`start.bat`**.
3. A black window opens and the site opens in your browser at **http://localhost:3000**.
   * If Node.js is installed, `start.bat` uses it. Otherwise it uses a server built into Windows
     PowerShell, so nothing needs to be installed.
4. Keep the black window open while you use the site. To stop the server, close that window
   (or press `Ctrl + C` in it).

If Windows shows "Windows protected your PC", click **More info → Run anyway**. The file only starts
the local server.

### Option 2: any computer with Node.js (Windows, macOS, Linux)

1. Install Node.js 18 or newer from https://nodejs.org (the LTS version). If you can't install
   programs, the "Windows Binary (.zip)" download runs without installing.
2. Open a terminal in the project folder:
   * Windows: open the folder in File Explorer, click the address bar, type `cmd` and press Enter.
   * macOS: right-click the folder in Finder → **New Terminal at Folder**.
3. Start the server:

   ```bash
   node server/server.js --open
   ```

   `npm start` does the same thing. No `npm install` is needed because the project has no dependencies.
4. The site opens at **http://localhost:3000**. Press `Ctrl + C` in the terminal to stop it.

### Option 3: Visual Studio Code

1. Install the **Live Server** extension (by Ritwick Dey).
2. Open the project folder in VS Code (**File → Open Folder**).
3. Click **Go Live** in the bottom-right corner. The project settings make it use port 3000.

### Option 4: Python (macOS and Linux)

```bash
python3 -m http.server 3000
```

Then open http://localhost:3000. On Windows, use option 1 instead: Python there can send JavaScript
files with the wrong type, and the page stays blank.

### Port 3000 is busy?

`start.bat` and `server/server.js` automatically try 3001, 3002 and so on, and print the address they used.
To pick a port yourself, run `node server/server.js --port 4000`. To open the site from a phone on the same
Wi-Fi, run `node server/server.js --host 0.0.0.0` and visit `http://<your-computer-ip>:3000`.

### Internet connection

Match data, team badges and stadium photos come from public APIs, so the first visit needs internet.
After that, the last loaded data is kept in the browser and shown with a "Showing saved data" notice
when the connection drops.

## Publishing on GitHub Pages (free)

The site is plain files, so GitHub Pages can host it without a server. The workflow in
`.github/workflows/pages.yml` publishes it every time the `dev` branch changes.

1. On GitHub, open the repository → **Settings** → **Pages**. Under **Build and deployment**, set
   **Source** to **GitHub Actions**.
2. Still in **Settings**, open **Environments** → **github-pages**. Under **Deployment branches and
   tags**, add a rule for `dev` (by default only the default branch, `main`, may publish).
3. Push `dev` to GitHub. The **Deploy to GitHub Pages** run in the **Actions** tab starts on its own
   and takes about a minute.
4. The site is at `https://<your-user-name>.github.io/<repository-name>/`, for this repository
   `https://davegaspar.github.io/coursework_frontend/`.

Only the site files are published (`index.html`, `assets`, `components`, `pages`, `scripts`,
`styles`), plus a `404.html` made from the not-found page. After a new deploy, browsers can keep the
old files for up to 10 minutes. Accounts, tickets and admin changes are still saved in each visitor's
own browser, exactly as on a local server.

## Demo accounts

| Username | Password | Role |
|---|---|---|
| `admin_john` | `Admin#2026` | Admin: sees the Admin pages (teams, matches, reports) |
| `admin_sara` | `Admin#2026` | Admin |
| `viewer_mike` | `Viewer#2026` | Viewer: has a saved Mastercard ending 4444 |
| `viewer_anna` | `Viewer#2026` | Viewer: has a saved Visa ending 4242 |

You can also sign in with the email (for example `mike@sportslive.test`) or create a new account.

Test card for checkout: `4242 4242 4242 4242`, any future expiry date (for example `12/30`), any
3-digit CVV. No real payment is made. Only the last 4 digits, expiry, cardholder name and brand are
saved.

To start over with fresh data, open the browser's developer tools (`F12`) → **Application** →
**Local storage** → right-click the site → **Clear**, then reload the page.

## Project structure

```
index.html            the home page; the site starts here
start.bat             double-click to run the site on Windows
package.json          Node.js settings: start and check commands (no packages)
pages/<Name>/         every other page: <Name>.html with its own CSS and JS
  Live/               watch live: stream or live match center, chat, other games
  Tickets/            buy tickets: matches on sale with filters
  Checkout/           ticket quantity, payment and confirmation
  Auth/               sign in and sign up
  Account/            my tickets and saved cards
  Admin/              teams, matches and reports (admins only)
  NotFound/           the "page not found" page
components/<Name>/    reusable UI pieces: <Name>.html, <Name>.css, <Name>.js
styles/               index.css (colours, spacing, fonts, base styles), components.css
scripts/              shared JavaScript
  core/               helpers: settings, requests, cache, formatting, validation, theme
  data/               data layer: repositories, public API clients, browser storage
  i18n/               translation engine (English and Armenian)
  services/           sign-in state, live score refresh, match text helpers
assets/               fonts, icons, images, translations.json, manifest, vendor/ (Chart.js)
server/               server.js (Node.js) and serve.ps1 (Windows, no install)
tools/                developer checks and asset builders (need Node.js)
docs/API.md           the REST API the backend team needs to build
```

## Trying the live features

- **Chat:** open the same match on Watch live in two tabs. Messages go between the tabs in real time
  (they are not saved). Signing in is needed to write; each tab has its own sign-in.
- **Live match center:** it appears automatically while a real match is being played. To see it at
  any time, sign in as an admin, open Admin → Matches, edit an upcoming match and set its status to
  Live, then open it on Watch live.
- **Stream:** in the same dialog, a YouTube link in "Stream URL" is shown in the Watch live player.

## Data sources

| Source | Used for |
|---|---|
| [OpenLigaDB](https://www.openligadb.de) | Bundesliga and 2. Bundesliga fixtures, results, live scores and goals |
| [TheSportsDB](https://www.thesportsdb.com) (free key) | Premier League and Champions League fixtures, team badges, stadiums, capacities, squads, posters, highlights, goals and cards |
| [Wikipedia](https://www.wikipedia.org) | Stadium photos when TheSportsDB has none (credited on the page) |

Ticket prices, attendance where the API has none, and revenue figures are not available from any
public API. They are generated from a fixed seed per match, so they stay the same on every load.
Referees are never made up: when the API has no referee, the page says "To be announced".

## Switching to the real backend

Set `DATA_SOURCE = 'backend'` in `scripts/core/config.js`. Everything the backend must provide is
described in `docs/API.md`.

## Developer checks (need Node.js)

```bash
npm run check
```

This fails if any file is over 500 lines, if English and Armenian translations don't have the same
keys, or if an HTML file contains untranslated text.

## Credits

Icons: [Lucide](https://lucide.dev) (ISC). Card brand logos: [Simple Icons](https://simpleicons.org) (CC0).
Fonts: Inter, Barlow Condensed and Noto Sans Armenian (SIL Open Font License).
Charts: [Chart.js](https://www.chartjs.org) 4.5.1 (MIT), included in `assets/vendor` so it works without a CDN.
