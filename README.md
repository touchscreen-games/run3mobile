# Run3Source
**it is quite literally the game run 3's source lmfao**

you need a webserver or a github page for the html to actually work.

### IF ANYONE KNOWS HOW TO DECOMPILE OPENFL SOURCE THAT WILL BE REALLY COOL LOL

i'll eventually add some explanations for some stuff if anyones interested in "modding" run 3

### touch controls

`touch-controls.js` adds on-screen thumb controls so the game is playable on a
phone or tablet. It is loaded from `index.html` and does not modify `Run3.js`.

The compiled game is keyboard-only: lime listens for `keydown`/`keyup` on
`window`, and the game's `KeyControlScheme` maps raw browser key codes onto its
`left` / `right` / `up` / `jump` inputs. The overlay draws buttons and
synthesises those key events, so touch input takes exactly the same path as a
real key press. Menus already worked on touch devices, because lime turns the
primary touch point into a `mouseDown` by itself.

* left / right hold `ArrowLeft` (37) and `ArrowRight` (39)
* the big button holds `ArrowUp` (38), which the game reads as both `up` and `jump`
* the small button holds `ArrowDown` (40), used by the gravity-flipping characters
* multi-touch works, and sliding a finger from one button to another switches inputs
* keys are released on `blur` and on tab hide, so nothing gets stuck down

The chips in the top-left hide/show the pad (handy on the map screen) and
toggle fullscreen. The pad appears automatically on touch devices; add
`?touch=1` to force it on for testing on a desktop, or `?touch=0` to force it off.

The overlay lives in `<body>` rather than inside `#openfl-content` on purpose:
lime registers capturing touch listeners on that element, so a button placed
inside it would also register as a tap on the game world.
