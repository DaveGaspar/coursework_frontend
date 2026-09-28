# Sports Live REST API

This is the contract the frontend expects from the backend. Today the site runs on public APIs plus
`localStorage` (`DATA_SOURCE = 'hybrid'`). When this API exists, set `DATA_SOURCE = 'backend'` in
`scripts/core/config.js`. Nothing outside `scripts/data/` changes, because every page talks to the
repositories in `scripts/data/index.js`, and `scripts/data/sources/backend/backend.js` already calls
each endpoint below.

All example values are real data imported on 2026-09-27.

## Conventions

| Topic | Rule |
|---|---|
| Base URL | `/api` on the same origin (`BACKEND_BASE_URL`) |
| Format | JSON request and response bodies, UTF-8. Dates are ISO 8601 in UTC (`2026-10-10T11:30:00.000Z`). Money is a number in USD with 2 decimals. The site converts it for display (dram in Armenian). |
| Auth | Session cookie (`HttpOnly`, `Secure`, `SameSite=Lax`) set by sign-in / sign-up. The frontend sends `credentials: 'include'`. |
| Roles | `viewer` (default at sign-up) and `admin`. |
| IDs | Integers (`SERIAL`). |
| Success | `200` with a body, `201` for creates, `204` with no body where noted. |
| Timeouts | The frontend aborts after 8 s and retries a `GET` once. |

### Error format

Every error uses the same shape. `code` is stable and mapped to translated text by the frontend, so
never rely on `message` for the UI.

```json
{
  "error": {
    "code": "validation",
    "message": "Invalid card",
    "fields": { "number": "validation.cardNumberInvalid" }
  }
}
```

`fields` is optional. Its values are translation keys the frontend already has (list at the end).

| HTTP | `code` | When |
|---|---|---|
| 400 | `validation` | Invalid body (with `fields`) |
| 400 | `match_not_on_sale` | Buying tickets for a live or finished match |
| 401 | `unauthorized` | Not signed in |
| 401 | `invalid_credentials` | Wrong username/email or password |
| 402 | `card_declined` | Payment provider declined the card |
| 403 | `forbidden` | Signed in, but not an admin |
| 404 | `not_found` | Unknown id |
| 409 | `username_taken`, `email_taken` | Sign-up conflicts (with `fields`) |
| 409 | `not_enough_tickets` | Quantity is more than the tickets left (with `fields.quantity`) |
| 429 | `rate_limited` | Too many requests |
| 5xx | `server` | Anything unexpected |

## Database

| Table | Columns |
|---|---|
| `users` | `id`, `username` (unique), `email` (unique, lower-case), `password_hash`, `role`, `created_at` |
| `teams` | `id`, `name`, `coach_name`, `logo_url`, `created_at` |
| `players` | `id`, `team_id` → teams, `full_name`, `position`, `jersey_number` (1–99, unique per team, nullable), `created_at` |
| `matches` | `id`, `home_team_id`, `away_team_id`, `venue`, `scheduled_at`, `status`, `league`, `stream_url`, `home_score`, `away_score`, `attendance`, `total_fouls`, `yellow_cards`, `red_cards`, `revenue_tickets`, `revenue_merchandise`, `revenue_sponsorship`, `revenue_concessions`, `ticket_price`, `ticket_capacity`, `referee`, `poster_url`, `created_at` |
| `tickets` | `id`, `match_id` → matches, `user_id` → users, `quantity`, `seat_zone` (`goal`, `side`, `main`, `vip`), `price_per_ticket`, `purchased_at` |
| `payment_cards` | `id`, `user_id` → users, `cardholder_name`, `card_last_four`, `expiry_date` (`MM/YY`), `brand`, `is_default`, `created_at` |

Enums: `status` is `upcoming | live | finished`; `position` is `Goalkeeper | Defender | Midfielder | Forward`;
`role` is `viewer | admin`; `brand` is `visa | mastercard | amex`.

**Security rules**

* Passwords are hashed on the server (bcrypt or Argon2). The hash is never returned.
* Full card numbers and CVVs are never stored or logged. They go to the payment provider only;
  the database keeps the name, last four digits, expiry and brand.
* Every `/me/*` route only returns rows of the signed-in user.

## Computed fields

Responses contain the table columns plus these fields. The frontend relies on them.

**Match**

| Field | Meaning |
|---|---|
| `home_team`, `away_team` | `{ id, name, short_name, logo_url }` |
| `tickets_left` | `ticket_capacity` minus the sum of `tickets.quantity` for the match (never below 0) |
| `goals` | `[{ minute, scorer, team: "home" \| "away", home_score, away_score, is_penalty, is_own_goal }]`, ordered by minute |
| `live_minute`, `live_period` | Match clock while `live` (`live_period`: `1H`, `HT` or `2H`), else `null` |
| `highlights_url` | YouTube link for finished matches, else `null` |
| `backdrop_url` | Wide image for hero banners (event thumb, club fan art or stadium photo) |
| `venue_image_url`, `venue_image_credit` | Stadium photo and `{ label, url }` credit shown under it |

**Team**

| Field | Meaning |
|---|---|
| `short_name` | 3-letter code, e.g. `CHE` |
| `venue` | Home stadium |
| `leagues` | League names the team has matches in |
| `player_count`, `match_count` | Counts |
| `players` | Only with `?with=players`, sorted by jersey number |

## Auth

### POST /api/auth/signin

Public. `login` is a username or an email.

```json
{ "login": "admin_john", "password": "••••••••" }
```

`200`, sets the session cookie:

```json
{ "user": { "id": 1, "username": "admin_john", "email": "john@sportslive.test", "role": "admin", "created_at": "2026-09-27T16:51:38.098Z" } }
```

Errors: `401 invalid_credentials` (the same answer for an unknown user and a wrong password).

### POST /api/auth/signup

Public. Creates a `viewer` and signs them in.

```json
{ "username": "new_fan", "email": "fan@example.com", "password": "at-least-8-chars" }
```

`201` with `{ "user": { … } }`. Errors: `400 validation`, `409 username_taken`, `409 email_taken`.
Rules: username 3–30 characters (letters, digits, `_`, `.`), valid email, password of at least 8 characters.

### POST /api/auth/signout

`204`. Clears the session.

### GET /api/auth/me

`200` with `{ "user": { … } }`, or `401 unauthorized` when signed out (the frontend treats this as "guest").

## Matches

### GET /api/matches

Public. Query parameters (all optional):

| Param | Example | Meaning |
|---|---|---|
| `status` | `live,upcoming` | One or more statuses, comma-separated |
| `league` | `Premier League` | Exact league name |
| `date` | `2026-10-10` | Kick-off date (UTC) |
| `q` | `arsenal` | Team name contains (case- and accent-insensitive) |
| `team_id` | `50` | Home or away team |
| `sort` | `asc` / `desc` | By `scheduled_at` (default `asc`) |
| `limit` | `10` | Max rows |

`200` with an array of matches:

```json
[{
  "id": 148,
  "home_team_id": 50,
  "away_team_id": 55,
  "venue": "Emirates Stadium",
  "scheduled_at": "2026-10-10T11:30:00.000Z",
  "status": "upcoming",
  "league": "Premier League",
  "stream_url": null,
  "home_score": null, "away_score": null,
  "attendance": null, "total_fouls": null, "yellow_cards": null, "red_cards": null,
  "revenue_tickets": null, "revenue_merchandise": null, "revenue_sponsorship": null, "revenue_concessions": null,
  "ticket_price": 90,
  "ticket_capacity": 60338,
  "referee": null,
  "poster_url": "https://r2.thesportsdb.com/images/media/event/poster/ekc9q71784549630.jpg",
  "created_at": "2026-09-27T16:51:42.130Z",
  "home_team": { "id": 50, "name": "Arsenal", "short_name": "ARS", "logo_url": "https://r2.thesportsdb.com/images/media/team/badge/uyhbfe1612467038.png" },
  "away_team": { "id": 55, "name": "Leeds United", "short_name": "LEE", "logo_url": "https://r2.thesportsdb.com/images/media/team/badge/jcgrml1756649030.png" },
  "tickets_left": 60338,
  "goals": [],
  "live_minute": null,
  "live_period": null,
  "highlights_url": null,
  "backdrop_url": "https://r2.thesportsdb.com/images/media/event/thumb/mayo9h1784549326.jpg",
  "venue_image_url": "https://r2.thesportsdb.com/images/media/venue/thumb/br6s761786310366.jpg",
  "venue_image_credit": { "label": "TheSportsDB", "url": "https://www.thesportsdb.com" }
}]
```

### GET /api/matches/:id

Public. `?fresh=1` asks the server to refresh the score, goals and cards from its data provider
before answering (used by the live page every 30 s). `200` with one match. A finished example:

```json
{
  "id": 91,
  "venue": "Vitality Stadium",
  "scheduled_at": "2026-09-12T14:00:00.000Z",
  "status": "finished",
  "league": "Premier League",
  "home_score": 2, "away_score": 2,
  "attendance": 10412,
  "total_fouls": 19, "yellow_cards": 2, "red_cards": 0,
  "revenue_tickets": 575564, "revenue_merchandise": 131468, "revenue_sponsorship": 1704000, "revenue_concessions": 183000,
  "ticket_price": 70, "ticket_capacity": 11464,
  "home_team": { "id": 37, "name": "Bournemouth", "short_name": "BOU", "logo_url": "https://r2.thesportsdb.com/images/media/team/badge/y08nak1534071116.png" },
  "away_team": { "id": 38, "name": "Brentford", "short_name": "BRE", "logo_url": "https://r2.thesportsdb.com/images/media/team/badge/grv1aw1546453779.png" },
  "goals": [
    { "minute": 34, "scorer": "Kevin Schade", "team": "away", "home_score": 0, "away_score": 1, "is_penalty": false, "is_own_goal": false },
    { "minute": 38, "scorer": "Justin Kluivert", "team": "home", "home_score": 1, "away_score": 1, "is_penalty": false, "is_own_goal": false }
  ],
  "highlights_url": "https://www.youtube.com/watch?v=l6xGfxVKQRU",
  "…": "other columns and computed fields as in the list"
}
```

Errors: `404 not_found`.

### GET /api/leagues

Public. `200`: `[{ "name": "Premier League" }, { "name": "UEFA Champions League" }, { "name": "Bundesliga" }, { "name": "2. Bundesliga" }]`

### POST /api/matches · PUT /api/matches/:id

Admin. Body: any writable match column (`home_team_id`, `away_team_id`, `scheduled_at`, `status`,
`league`, `venue`, `stream_url`, `referee`, `poster_url`, the scores, stats, revenue columns,
`ticket_price`, `ticket_capacity`). `PUT` accepts a partial body.

Validation: both teams exist and differ (`validation.sameTeams`), `league`, `status`, `scheduled_at`,
`ticket_price` and `ticket_capacity` are required, whole numbers ≥ 0 for counts, money ≥ 0 with
2 decimals, URLs must be http(s).

`201` / `200` with the match. Errors: `400 validation`, `403 forbidden`, `404 not_found`.

### DELETE /api/matches/:id

Admin. **Cascade:** deletes the match's tickets. `200`: `{ "deleted_tickets": 3 }`

### POST /api/matches/refresh

Admin. Re-imports fixtures and results from the data providers without overwriting columns an admin
edited. `200`: `{ "leagues": [{ "league": "epl", "ok": true, "count": 50 }, …] }`

## Teams and players

### GET /api/teams

Public. `?with=players` includes each team's players. `200`:

```json
[{
  "id": 43,
  "name": "Chelsea",
  "coach_name": null,
  "logo_url": "https://r2.thesportsdb.com/images/media/team/badge/pbf4ul1782638263.png",
  "created_at": "2026-09-27T16:51:41.508Z",
  "short_name": "CHE",
  "venue": "Stamford Bridge",
  "leagues": ["Premier League"],
  "player_count": 10,
  "match_count": 5
}]
```

### GET /api/teams/:id

Public. Same shape. With `?with=players`:

```json
"players": [
  { "id": 13, "team_id": 43, "full_name": "Emiliano Martinez", "position": "Goalkeeper", "jersey_number": 1, "created_at": "2026-09-27T16:54:12.217Z" },
  { "id": 18, "team_id": 43, "full_name": "João Pedro", "position": "Forward", "jersey_number": 9, "created_at": "2026-09-27T16:54:12.217Z" }
]
```

### POST /api/teams · PUT /api/teams/:id

Admin. Body: `{ "name": "Chelsea", "coach_name": "Jane Doe", "logo_url": "https://…" }`
(`name` required, max 100 characters; `logo_url` optional http(s) URL). `201` / `200` with the team.

### DELETE /api/teams/:id

Admin. **Cascade:** deletes the team's players, every match it plays in, and those matches' tickets.
The frontend warns about this in the confirm dialog.

`200`: `{ "deleted_players": 10, "deleted_matches": 5, "deleted_tickets": 2 }`

### POST /api/players · PUT /api/players/:id · DELETE /api/players/:id

Admin. Body: `{ "team_id": 43, "full_name": "Cole Palmer", "position": "Midfielder", "jersey_number": 10 }`.
`jersey_number` is optional, 1–99, unique within the team (`validation.jerseyTaken`).
`201` / `200` with the player; `DELETE` answers `204`.

## Tickets

### POST /api/tickets

Signed in. Buys tickets for an `upcoming` match. Pay with a saved card:

```json
{ "match_id": 46, "quantity": 2, "zone": "main", "card": { "saved_card_id": 1 } }
```

or with a new card (sent to the payment provider, never stored in full; `save: true` stores the safe
fields as a saved card):

```json
{ "match_id": 46, "quantity": 2, "zone": "main", "card": { "number": "4242 4242 4242 4242", "expiry": "12/30", "cvv": "123", "name": "Mike Davis", "save": true } }
```

`quantity` is 1–10. `zone` is the stand: `goal` (behind the goal, ×1), `side` (×1.5), `main` (×2) or `vip` (×4).
The server sets `price_per_ticket` = the match's `ticket_price` × the zone multiplier, rounded to cents; never trust a
price sent by the browser. `201`:

```json
{
  "ticket": { "id": 1, "match_id": 46, "user_id": 3, "quantity": 2, "seat_zone": "main", "price_per_ticket": 60, "purchased_at": "2026-09-27T16:52:21.659Z" },
  "match": { "…": "the match with the new tickets_left" },
  "total": 120,
  "card": { "brand": "visa", "card_last_four": "4242" }
}
```

Errors: `400 validation` (card fields: `number`, `expiry`, `cvv`, `name`; or `quantity`, `zone`),
`400 match_not_on_sale`, `409 not_enough_tickets`, `402 card_declined`, `401 unauthorized`.
The check for tickets left and the insert must run in one transaction.

### GET /api/me/tickets

Signed in. The user's tickets, each with its `match` (computed fields included), ordered live →
upcoming (soonest first) → finished (latest first).

## Saved cards

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/me/cards` | | `200` array, default card first |
| POST | `/api/me/cards` | `{ "number", "expiry", "cvv", "name", "make_default": false }` | `201` card |
| PUT | `/api/me/cards/:id/default` | | `204` |
| DELETE | `/api/me/cards/:id` | | `204` (if it was the default, the newest remaining card becomes default) |

The first saved card becomes the default. Card example:

```json
{ "id": 1, "user_id": 3, "cardholder_name": "Mike Davis", "card_last_four": "4444", "expiry_date": "11/28", "brand": "mastercard", "is_default": true, "created_at": "2026-09-27T16:51:38.168Z" }
```

## Reports (admin)

Both endpoints use finished matches only and accept an optional `?league=`.

### GET /api/reports/summary

```json
{
  "total_matches": 74,
  "avg_attendance": 39648,
  "total_revenue": 413162252,
  "total_goals": 239,
  "revenue_by_stream": { "tickets": 240312739, "sponsorship": 95741000, "merchandise": 35644668, "concessions": 41463845 }
}
```

### GET /api/reports/matches

Newest first:

```json
[{
  "id": 27,
  "home_team": { "id": 6, "name": "SC Paderborn 07", "short_name": "PAD", "logo_url": "https://upload.wikimedia.org/wikipedia/commons/e/e3/SC_Paderborn_07_Logo.svg" },
  "away_team": { "id": 7, "name": "TSG Hoffenheim", "short_name": "HOF", "logo_url": "https://i.imgur.com/gF0PfEl.png" },
  "league": "Bundesliga",
  "venue": null,
  "scheduled_at": "2026-09-20T17:30:00.000Z",
  "home_score": 3, "away_score": 1,
  "attendance": 37929,
  "total_fouls": 17, "yellow_cards": 4, "red_cards": 0,
  "revenue_tickets": 1792319, "revenue_merchandise": 290232, "revenue_sponsorship": 723000, "revenue_concessions": 502583,
  "revenue_total": 3308134
}]
```

## Live chat (later)

The live page uses `BroadcastChannel` today, which only reaches other tabs in the same browser.
For real chat, provide a WebSocket at `/ws/chat?match=<id>` (`CHAT_WS_URL`). Messages are JSON:

```json
{ "type": "message", "match_id": 148, "user": "viewer_mike", "text": "What a goal!", "sent_at": "2026-10-10T12:15:03.000Z" }
```

The server should add `user` from the session, limit `text` to 280 characters and rate-limit senders.

## Validation keys

`validation.required`, `tooLong`, `wholeNumber`, `outOfRange`, `money`, `urlInvalid`, `dateTime`,
`sameTeams`, `jerseyNumber`, `jerseyTaken`, `quantity`, `notEnoughTickets`, `cardChoose`,
`cardNumberRequired`, `cardNumberLength`, `cardNumberInvalid`, `expiryRequired`, `expiryFormat`,
`expiryMonth`, `expiryPast`, `cvvRequired`, `cvvLength`, `cvvAmex`, `cardholderRequired`,
`cardholderInvalid`, `usernameRequired`, `usernameLength`, `usernameChars`, `usernameTaken`,
`emailRequired`, `emailInvalid`, `emailTaken`, `passwordRequired`, `passwordLength`.
