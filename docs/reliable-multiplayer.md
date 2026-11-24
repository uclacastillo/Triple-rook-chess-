# Feature: Reliable multiplayer (review branch)

**Author of the game concept: Noah.** 🎮

This change replaces the previous PeerJS peer-to-peer online game with Cloudflare-hosted, persistent game rooms. It leaves the original `initialBoard`, `movesFor`, `resolveRound`, and original piece-style gallery untouched on the website.

### Verification

- `npm test` (server): secure room tokens, hidden secret moves, simultaneous resolution, double collisions, mutual capture, promotions, invalid moves, expiry and resume.
- `npm run check`: JavaScript syntax.
- Browser integration requires the Cloudflare Worker to be deployed and configured; do not merge or enable the new online mode before two-device smoke testing.

### Deployment

See `multiplayer-worker/README.md`. After account authorization, deploy the Worker and set `assets/multiplayer-config.js` to the resulting `workers.dev` URL. Add the exact preview origin to `FRONTEND_ORIGIN` in Wrangler config for testing. Neither key nor account ID should be committed to the frontend.

### UX guarantees

- Blue and Red cannot see one another's move choices until both lock.
- Loading an invitation shows connection status, not a false move-sent message.
- Offline and retry states are visible; local vs computer mode still works.
- The host and guest can reopen the same game on their original browsers.
- The game does not require players' phones to establish a direct peer-to-peer connection.
