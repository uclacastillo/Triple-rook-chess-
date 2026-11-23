# Four Piece Styles — Noah's Triple Rook Chess

This branch offers **exactly four** player-selectable sets: Character Crew, Neo Arena, Mythic Quest, and Atelier Modern.

## How to use
- On Home, choose one of four cards. The choice applies immediately and is stored locally in the browser.
- Select **See all 4** for a larger 2.5D preview before confirming a set.
- Open the palette button during a game to change the art without restarting the round.
- The original **3D / 2D** toggle remains available. It changes perspective, not the chosen set.

## Asset structure
- `assets/character-crew/` contains the original 24 Character Crew images.
- `assets/styles/{neo-arena,mythic-quest,atelier-modern}/` contains 24 transparent WebP files for each additional set: Blue/Red × six piece types × front/back.
- `assets/style-previews/` holds four composite thumbnails for the style picker.
- `assets/style-gallery.js` and `assets/style-gallery.css` add the visual UI. The game engine in `index.html` is unchanged.

## Testing
- Tested locally at 320, 375, 390, 430, and 1180 px in Chromium (no JS errors or horizontal overflow).
- All 64 hit areas, 32 starting pieces, style changes, in-game preservation, and move selection were checked.
- The multiplayer feature was preserved but not two-device end-to-end tested.
- Original 3D artwork is used as reference; production pieces are transparent 2D WebP sprites, not rigged 3D models.

Created with Noah as the game designer; visual sets may evolve with his feedback.
