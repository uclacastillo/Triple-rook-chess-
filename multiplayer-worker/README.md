# Reliable multiplayer backend — Triple Rook Chess

Designed for **Noah's Triple Rook Chess**. The existing Vercel website remains the frontend. This service replaces peer-to-peer PeerJS invitations with server-authoritative HTTPS rooms on **Cloudflare Workers + SQLite-backed Durable Objects**.

## Setup

1. Create or sign into Cloudflare: https://dash.cloudflare.com/ . Activate your `workers.dev` subdomain if prompted.
2. From this directory, run `npm install` and then `npx wrangler login` (sign in in your own browser; never share tokens in chat).
3. Check `wrangler.jsonc`: `FRONTEND_ORIGIN` should contain the exact website origins allowed to call the Worker. It is set to `https://triple-rook-chess.vercel.app`. For a Vercel feature preview, add that exact preview origin separated by a comma (no trailing `/`).
4. Run `npm test` and `npx wrangler deploy` from this directory. Cloudflare will create the SQLite-backed `GameRoom` Durable Object namespace automatically from the `exports` configuration.
5. Note the Worker URL, e.g. `https://triple-rook-multiplayer.YOUR-SUBDOMAIN.workers.dev`.
6. In the Vercel frontend, set `window.TRIPLE_ROOK_API_URL` in `assets/multiplayer-config.js` to that Worker URL. Commit the configuration on **the feature branch first**, then test before merging.

No custom domain, database provisioning, WebSocket server, or paid Cloudflare plan is required for an initial prototype. The Worker URL is public; **never** put API tokens in the frontend configuration.

## Protocol

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/v1/health` | GET | Health probe |
| `/v1/rooms` | POST | Create room; returns host token and a separate one-time guest invitation token |
| `/v1/rooms/{id}/join` | POST | Join with `{ "inviteToken": "..." }`; returns guest session token |
| `/v1/rooms/{id}/state` | GET | Authenticated room snapshot (`Authorization: Bearer <sessionToken>`) |
| `/v1/rooms/{id}/moves` | POST | Authenticated `{ "round": 1, "move": { "from": {"r":6,"c":4},"to":{"r":4,"c":4} } }` or `{ "pass": true }` |

Room snapshots expose whether each participant has locked a move, but **never the moves themselves** until both have submitted. The backend verifies ownership, legality, and round numbers, then resolves moves simultaneously. It preserves the three-original-rook win rule, mutual captures, collisions, promotions, and double-pass draws.

## Recovering sessions

The host token is stored locally on the host's browser and the guest token on the guest's browser. Room IDs alone cannot access private board state. The one-time invitation secret is placed in the URL **fragment**, not the query string, so it is not transmitted to Vercel. After joining, that fragment is removed from the address bar. A returning player reuses their saved token to fetch the current room state. A new browser without the saved token cannot impersonate a player in an occupied room.

Rooms expire after seven days. Both moves and all round history are saved in Durable Object storage. The client polls via HTTPS with a backoff on failures and retries on foreground resume. Polling is deliberate for initial reliability; live updates can be added later.

## Limits / next steps

- The browser's `localStorage` must survive for automatic session restoration. Clearing browser data loses the session token.
- No spectators, matchmaking, user accounts, chat, or ranked gameplay in v1.
- Run a real **two-phone test across Wi-Fi and cellular** before enabling this for all players.
- Workers Free has quotas. Check current limits in Cloudflare's [Durable Objects pricing documentation](https://developers.cloudflare.com/durable-objects/platform/pricing/).
- For staging, configure the exact Vercel preview origin in `FRONTEND_ORIGIN`. Restrict origins; do not use arbitrary wildcard CORS.
