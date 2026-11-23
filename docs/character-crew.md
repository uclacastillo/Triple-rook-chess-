# Character Crew · 2.5D art experiment

**Designed for Noah's Triple Rook Chess** — an optional visual mode on a separate feature branch.

## Included assets

- `assets/board-2.5d.webp` — separate warm wood-and-gold 8×8 board asset, 1200×1120 with transparency outside the board.
- `assets/character-crew/{blue|red}-{pawn|knight|bishop|queen|king-rook|rook}-{front|back}.webp` — **24 individual transparent 256×280 WebP assets**. Both teams and all six piece types have matching front/rear sprites.
- `assets/character-crew.css` — responsive art layout, touch-safe target highlights, and original Classic palette.
- `assets/character-crew.js` — opt-in view switching and visual rendering while keeping Noah's original game engine untouched.

### Visual approach

The board is slightly tilted using an artist-friendly, fixed perspective. The 64 clickable square polygons are calculated from the same board geometry, so touch targets match the artwork. Figures are positioned at each square's footpoint, automatically scale with the board, and layer from back to front.

The team nearest the viewer uses **rear-view sprites**, while the far team faces the viewer. This swaps automatically when an online guest views Red at the bottom.

The art uses Noah's approved **Character Crew** concept as a visual source; each figure was individually isolated and optimized for web. The king-rook remains distinguishable by the crenellated crown and castle crest. A character skin never changes movement, captures, or the three-original-rooks victory rule.

### Play and test

Open `index.html` in a browser or visit the Vercel branch preview. Start a game and use the **🎭 2.5D On / ♟ Classic** button to switch modes. The choice is remembered on the current device when local storage is available.

**Mobile priorities:** the board fits a 320px-wide viewport; buttons remain regular HTML controls for accessible selection; all images are static WebP with no GPU requirement; sprites do not intercept taps meant for their board squares.

### Next production pass

These are transparent, lightweight prototype sprites extracted from an approved concept sheet. A final premium-art pass could replace them with separately rendered high-resolution characters from one locked 3D camera/light setup, using the same filenames and board coordinates.

**Credit:** Noah — inventor and game designer of Triple Rook Chess. 💙
