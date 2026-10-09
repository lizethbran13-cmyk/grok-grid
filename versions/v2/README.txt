GROK GRID 2.0
=============

Arcade open-wheel racer. 6 tracks, 5 cars, walls that hurt.

What's new in 2.0
-----------------
- Five new circuits plus the original, each with its own layout, scenery
  and light:
    GROK PARK        classic parkland (original track, layout tidied)
    HARBOUR STREETS  city street circuit, 90-degree corners, chicane
    RED ROCK CANYON  desert sweepers between mesas, rolling elevation
    ALPINE SUMMIT    snowy mountain pass, big climbs and crests
    MIDNIGHT NEON    night track, floodlights and glowing barriers
    SUNSET COAST     seaside run with palms at golden hour
  The track select screen shows a mini map of each circuit.
- Smarter rivals: they follow a racing line, brake for corners, overtake
  on the inside, slipstream, and keep pace with you (rubber-banding).
  Choose RIVALS: EASY / NORMAL / HARD. Normal is much quicker than 1.0.
- LAPS: 1 / 3 / 5.
- Best lap per track and best race time per track/lap count are saved in
  your browser (localStorage).
- CHAMPIONSHIP: all six tracks in a row, points 10-6-4-2-1. A DNF scores
  nothing. You can leave and continue the season later.
- Pause button (or Esc / P). The game also pauses if you switch apps.
- Phone: landscape layout tuned, steering has a small dead zone, and the
  resolution adapts if frames drop.

Run it
------
Serve the folder (file:// will not load modules of this size reliably in
some browsers, so use a local server):

  cd grok-f1
  python3 -m http.server 8080

Then open http://localhost:8080

Controls
--------
Desktop:  W / ↑ accelerate
          S / ↓ / Space  brake
          A D or arrows  steer
          Shift          handbrake
Mobile:   left stick to steer, ACCEL / BRAKE on the right
♪ button  mute engine and impacts
II button pause (Esc / P on desktop)

Damage
------
Hits against barriers or other cars raise the DAMAGE bar (0–100).

  Scuffs        cheap, you keep most of the car
  Medium hits   front wing droops, top speed and grip drop
  Heavy hits    rear wing folds, smoke, random stalls
  100%          TERMINAL — DNF, race over

More damage means less top speed, heavier steering, and smoke off the
engine cover. Visual damage (bent/missing wings, darkened body) matches
the HUD. Retry from the DNF or chequered-flag card.

Title → (quick race: pick a track | championship) → lights out → finish or
DNF → retry / next round.
