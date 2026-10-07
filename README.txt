GROK GRID 3.0
=============

Arcade open-wheel racer. 8 tracks, 5 cars, walls that hurt.

What's new in 3.0
-----------------
- Steering rebuilt. In 2.0 the car lost most of its steering as speed rose
  (about 29 deg/s of turn flat out, a 150 m turning circle), so many corners
  were physically impossible without heavy braking and phone players hit
  the walls. 3.0 keeps roughly twice the steering at speed (~56 deg/s flat
  out, ~80 m circle; ~74 deg/s at low speed). AI rivals use the same car
  model, so races stay fair.
- Phone steering: the whole lower-left of the screen is the steering zone.
  Put your thumb down anywhere there and the stick appears under it; full
  lock is a short 46 px slide (2.0 needed the full 65 px pad radius, and a
  thumb that missed the small pad did nothing).
- Keyboard: steering keys ramp in over ~0.13 s, so taps are small
  corrections and a hold is full lock.
- STEER ASSIST (ON by default on phones, OFF on desktop, switch on the
  title screen): blends in a little help toward a clean line, helps more
  when you are about to run wide, and lifts the throttle if you arrive at a
  corner far too fast.
- Wall crashes are unchanged: hit a wall and you still take the damage.
- Two new tracks:
    JUNGLE TEMPLE  rainforest esses, stepped stone temples, waterfall,
                   falling leaves, rolling hills
    LUNAR BASE     on the Moon: long straights, tight crater hairpins,
                   domes, a rocket on its pad, Earth in a black sky
- Championship is now 8 rounds.

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
- CHAMPIONSHIP: every track in a row, points 10-6-4-2-1. A DNF scores
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
Mobile:   slide a thumb on the left half to steer, ACCEL / BRAKE on the right
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
