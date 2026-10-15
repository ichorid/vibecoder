# VIBE CODER — selected visual design references

These images are visual exploration references for the mobile-first 8/16-bit pixel-art incremental game, not finalized pixel-perfect UI or production sprite assets.

## Folder guide
- `00_style/`: **selected first style** from the five-option comparison: classic retro pixel art in light and dark modes. Other styles intentionally excluded.
- `01_main_game/`: four successive moments of the **same vertically oriented main Game screen** (plus individual crops), from a room to an abstract computational network.
- `02_technology_unlocks/`: 16 illustrated unlock/event concepts, both as an overview sheet and individual cards.
- `03_cat_system/`: pet interface, mood/hunger interactions, reaction mini-game, intrusive foreground cat, overfeeding and memorial (full sheets plus individual states).

## IMPORTANT: current design decisions override mockup imperfections
1. Exactly **three views**: Game, History, Cat. Main Game is one screen with gradually revealed controls, in the spirit of Universal Paperclips.
2. **Never show a ladder, locked technologies, future stage names, or a total stage count** on the main screen. History contains only discovered events/achievements/milestones.
3. Visual progression is **camera zoom-out through abstract subsystems, controllers, graphs, agents and self-improving harnesses**; do **not** use the apartment -> building -> city metaphor from earlier rejected concepts.
4. The developer and orange cat stay in the underlying world and shrink steadily: the cat eventually becomes a single orange pixel and finally disappears from visibility.
5. The header has a very small CAT button beside HISTORY. Place **two tiny HP-style bars immediately BELOW that button, EACH NO WIDER THAN THE BUTTON**, approximately 3–4 CSS px high, with no always-visible labels. Bars show **physical health and mood**. Fullness is available on the Cat view. Some reference renders put larger bars elsewhere; ignore those layouts.
6. Cat view contains FEED, PLAY (moving mouse timing bar, three attempts with randomized hit zone), and PET. Neglect can cause permanently irreversible death. After death, Cat view has only two happy photos, without care buttons.
7. Cat has a normal world-space sprite that shrinks with camera zoom, and an independent, LARGE foreground attention-seeking sprite that can obstruct controls when neglected.
8. Light/dark theme is a user option independent of game stage. Do not make dark theme an automatic consequence of technology progression.
9. Each technology unlock shows its own playful 8/16-bit illustration; artwork in the sheet is a compositional reference, not an exact final list or ordering.
10. Keep controls minimal and touch-friendly, without permanent tool panels or dashboards.

These images are deliberately grouped by what is **still relevant**. Older geographical-zoom mockups and the original non-pixel-art style alternatives are omitted to avoid contradictory references.
