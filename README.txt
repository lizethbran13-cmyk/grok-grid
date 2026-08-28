GROK GRID
=========

Arcade F1. Crash the car, watch it come apart, try to finish 3 laps.

How to run
  Open this folder with a static server (needed for some browsers to load Three.js):

    python3 -m http.server 8080

  Then visit http://localhost:8080/

  Relative paths only — also works on GitHub Pages. A local copy of Three.js
  lives in three.min.js (no CDN required).

Controls (desktop)
  W / Arrow Up           accelerate
  S / Arrow Down / Space brake
  A D or Left / Right    steer
  Shift                  handbrake (big slides)
  Enter                  start / retry from overlays
  ♪ button               mute engine

Controls (phone / tablet)
  Left pad               steer (drag)
  ACCEL / BRAKE          right-side pedals
  Touch is auto-detected and the HUD keeps clear of the home indicator.

How to play
  3 laps around Grok Park against 4 AI cars. Hold it on the black stuff.
  Grass is slow. Barriers bite. Other cars bite too.

Damage
  Hits against walls, tecpro, or other cars fill the DAMAGE bar.
  Light scrape     scuffed paint, a little less grip
  ~25%             front wing bends, handling goes off
  ~40–50%          front wing gone, smoke, lower top speed
  ~70%             rear wing folds / rips off, car gets loose
  100%             DNF — terminal damage, retry from the overlay

  More damage = slower, worse grip, smoke, and a wobbly steering rack.

HUD
  LAP, POS, lap time, best lap, speed (km/h), gear, damage bar, minimap.

Goal
  Finish P1 if you can. Don't bin it.
