# Final Completion Animation Prototype

This folder is a standalone prototype. It is not wired into the Summer Quest production app.
The starting Final Quest sheet and ending Final Summary sheet reuse the production
HTML structure, component classes, typography, spacing, colors, and local artwork.

## Open locally

Open `index.html` directly in a modern browser. No build step or dependencies are required.

## Tune the sequence

All major timings, holds, overlaps, and easing curves are grouped in the `TIMING`
object at the top of `script.js`.

The simulated upload/completion sequence is the zero-based `COMPLETION_ORDER` array directly below the timing object. The current order forms a diagonal wave and is intentionally different from numerical board order.

## Replace placeholder photos

The prototype uses one offline 5×5 contact sheet:

`assets/summer-photo-contact-sheet.png`

Replace that file with another square, edge-to-edge 5×5 image sheet to update all
tiles without code changes. Individual image files can also be used by changing
the `.tile-photo` assignment in `buildBoards()`.

## Inspect the motion

- Replay restarts the full sequence.
- Pause / Resume freezes and continues the master timeline.
- Playback speed supports 0.5×, 1×, 1.5×, and 2×.
- The timeline can be clicked or dragged at any time, including while paused.
- Sweep, Photo wave, Final flips, Message, Ranks, and Summary jump buttons seek to useful inspection moments.
- Reduced motion keeps the same timeline but removes most travel, spin, and 3D emphasis.
- The Message dropdown swaps among options A–D without replaying.
- Press `M` when focus is outside a form control to cycle through the closing-copy options.
