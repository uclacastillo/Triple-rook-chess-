# Character Crew Arena UI — preview

Built for Noah's **Triple Rook Chess** as a presentation-only layer on the `feature/character-crew-2-5d` branch.

- Keeps the existing simultaneous-move rules, original three-rook lives, computer AI, game history, and online peer-play logic unchanged.
- Uses all 24 front/back Character Crew sprites and a separate 2.5D board.
- Blue's pieces show their backs when Blue is at the bottom; Red faces the camera. Online Red's perspective flips naturally.
- Player panels show **actual original rook lives** and **current round**, rather than illustrative ratings or fake timers from the concept image.
- Real controls: select squares, Lock In Move, Reveal Both Moves, Change, Pass, Rules, and switch to Classic board.
- All 64 perspective polygons remain clickable; highlights are drawn at square centers.
- Latest image treatments: polished title art, cleaner board texture, and narrower sprites to reduce overhang.
- Browser smoke tests: Chrome at 320, 390, 430, and 1180 px widths, touch-tap e2→e4, round resolution, classic view toggle, 32 visible pieces, and 64 interactive squares.

This is a prototype UI, not a replacement of Noah's gameplay decisions. Test online sessions between two devices before merging. The source concept art and the logo crop are generated game artwork, not actual 3D geometry.
