/*
 * touch-controls.js — on-screen touch controls for the Run 3 web build.
 *
 * The compiled game only reads the keyboard: lime's HTML5 backend listens for
 * keydown/keyup on `window` and the game's KeyControlScheme maps the raw
 * browser keyCodes below onto its "left" / "right" / "up" / "jump" inputs.
 * Menus already work on a phone, because lime turns the primary touch point
 * into a mouseDown, so all that is missing is movement input.
 *
 * This overlay draws thumb buttons and synthesises the matching key events.
 * Nothing in the game bundle is modified.
 *
 * The overlay lives in <body>, deliberately NOT inside #openfl-content: lime
 * registers capturing touch listeners on that element, so a button placed
 * inside it would also read as a tap on the game world.
 *
 *   ?touch=1  force the controls on (handy for testing on a desktop)
 *   ?touch=0  force them off
 */
(function () {
	'use strict';

	var STORE_HIDDEN = 'run3.touchControls.hidden';
	var STORE_HINT = 'run3.touchControls.hintSeen';

	/* Key codes the game's KeyControlScheme binds by default.
	   ArrowUp counts as both "up" and "jump", so one button covers both. */
	var BUTTONS = [
		{ id: 'left',  keyCode: 37, key: 'ArrowLeft',  code: 'ArrowLeft',  rot: -90, size: 1,    pad: 'left',  label: 'Move left' },
		{ id: 'right', keyCode: 39, key: 'ArrowRight', code: 'ArrowRight', rot: 90,  size: 1,    pad: 'left',  label: 'Move right' },
		{ id: 'down',  keyCode: 40, key: 'ArrowDown',  code: 'ArrowDown',  rot: 180, size: 0.68, pad: 'right', label: 'Down' },
		{ id: 'jump',  keyCode: 38, key: 'ArrowUp',    code: 'ArrowUp',    rot: 0,   size: 1.3,  pad: 'right', label: 'Jump' }
	];

	/* ---------------------------------------------------------------- setup */

	var forced = null;
	try {
		var q = new URLSearchParams(window.location.search);
		if (q.has('touch')) forced = q.get('touch') !== '0';
	} catch (e) {}

	function looksLikeTouch() {
		return ('ontouchstart' in window) ||
			(navigator.maxTouchPoints > 0) ||
			(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
	}

	if (forced === false) return;
	if (forced !== true && !looksLikeTouch()) return;
	if (!window.PointerEvent) return;

	function store(key, value) {
		try {
			if (value === undefined) return window.localStorage.getItem(key);
			window.localStorage.setItem(key, value);
		} catch (e) {}
		return null;
	}

	/* ------------------------------------------------------------ key events */

	function sendKey(type, button) {
		var ev;
		try {
			ev = new KeyboardEvent(type, {
				key: button.key,
				code: button.code,
				keyCode: button.keyCode,
				which: button.keyCode,
				bubbles: true,
				cancelable: true,
				composed: true
			});
		} catch (e) {
			ev = document.createEvent('Event');
			ev.initEvent(type, true, true);
			ev.key = button.key;
			ev.code = button.code;
		}

		/* keyCode/which are legacy init members; pin them down if the browser
		   dropped them, since that is the only field lime actually reads. */
		if (ev.keyCode !== button.keyCode) {
			try {
				Object.defineProperty(ev, 'keyCode', { get: function () { return button.keyCode; } });
				Object.defineProperty(ev, 'which', { get: function () { return button.keyCode; } });
			} catch (e2) {}
		}

		/* Dispatched on document so it reaches both document- and window-level
		   listeners, the same way a real key event would. */
		document.dispatchEvent(ev);
	}

	/* ------------------------------------------------------------------- DOM */

	var CSS = [
		'#tc-root{position:fixed;top:0;right:0;bottom:0;left:0;inset:0;',
		'z-index:2147483000;pointer-events:none;',
		'--tc-size:clamp(58px,16vmin,104px);--tc-gap:clamp(10px,2.4vmin,20px);',
		'font-family:"Comfortaa",system-ui,-apple-system,sans-serif;',
		'-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;',
		'-webkit-tap-highlight-color:transparent;touch-action:none}',
		'#tc-root.tc-off .tc-pad{display:none}',
		'#tc-root *{box-sizing:border-box}',

		'.tc-pad{position:absolute;bottom:calc(env(safe-area-inset-bottom,0px) + var(--tc-gap));',
		'display:flex;align-items:flex-end;gap:var(--tc-gap)}',
		'.tc-pad--left{left:calc(env(safe-area-inset-left,0px) + var(--tc-gap))}',
		'.tc-pad--right{right:calc(env(safe-area-inset-right,0px) + var(--tc-gap));',
		'flex-direction:column;align-items:flex-end}',

		'.tc-btn{pointer-events:auto;touch-action:none;display:flex;align-items:center;',
		'justify-content:center;width:var(--tc-w);height:var(--tc-w);border-radius:50%;',
		'border:2px solid rgba(255,255,255,.55);background:rgba(255,255,255,.13);',
		'color:#fff;opacity:.5;padding:0;margin:0;appearance:none;-webkit-appearance:none;',
		'transition:opacity .08s linear,background-color .08s linear,transform .08s linear}',
		'.tc-btn svg{width:46%;height:46%;fill:currentColor;display:block}',
		'.tc-btn[data-held="1"]{opacity:1;background:rgba(255,255,255,.4);transform:scale(.93)}',
		'@media (hover:hover){.tc-btn:hover{opacity:.75}}',

		'.tc-chips{position:absolute;top:calc(env(safe-area-inset-top,0px) + var(--tc-gap));',
		'left:calc(env(safe-area-inset-left,0px) + var(--tc-gap));display:flex;gap:8px}',
		'.tc-chip{pointer-events:auto;touch-action:none;width:38px;height:38px;padding:0;',
		'display:flex;align-items:center;justify-content:center;border-radius:11px;',
		'border:2px solid rgba(255,255,255,.4);background:rgba(0,0,0,.35);color:#fff;',
		'opacity:.42;appearance:none;-webkit-appearance:none}',
		'.tc-chip svg{width:19px;height:19px;fill:currentColor;display:block}',
		'.tc-chip[data-on="0"]{opacity:.28}',

		'.tc-hint{position:absolute;left:50%;transform:translateX(-50%);',
		'bottom:calc(env(safe-area-inset-bottom,0px) + var(--tc-size) + var(--tc-gap) * 2.4);',
		'max-width:min(78vw,340px);text-align:center;padding:9px 15px;border-radius:999px;',
		'background:rgba(0,0,0,.6);color:#fff;font-size:13px;line-height:1.35;',
		'opacity:1;transition:opacity .6s ease}',
		'.tc-hint[data-fade="1"]{opacity:0}'
	].join('');

	function arrowSVG(rot) {
		return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="transform:rotate(' +
			rot + 'deg)"><path d="M12 3.2 20.6 14h-4.9v6.8H8.3V14H3.4Z"/></svg>';
	}

	var PAD_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
		'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"/></svg>';
	var FULL_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
		'<path d="M3 3h7v2.6H5.6V10H3Zm11 0h7v7h-2.6V5.6H14Zm4.4 11H21v7h-7v-2.6h4.4ZM3 14h2.6v4.4H10V21H3Z"/></svg>';

	var style = document.createElement('style');
	style.textContent = CSS;
	document.head.appendChild(style);

	var root = document.createElement('div');
	root.id = 'tc-root';

	var pads = {
		left: document.createElement('div'),
		right: document.createElement('div')
	};
	pads.left.className = 'tc-pad tc-pad--left';
	pads.right.className = 'tc-pad tc-pad--right';

	BUTTONS.forEach(function (button) {
		var el = document.createElement('button');
		el.type = 'button';
		el.className = 'tc-btn';
		el.style.setProperty('--tc-w', 'calc(var(--tc-size) * ' + button.size + ')');
		el.setAttribute('aria-label', button.label);
		el.dataset.held = '0';
		el.innerHTML = arrowSVG(button.rot);
		pads[button.pad].appendChild(el);
		button.el = el;
		button.held = false;
	});

	root.appendChild(pads.left);
	root.appendChild(pads.right);

	/* ----------------------------------------------------------- chip toggles */

	var chips = document.createElement('div');
	chips.className = 'tc-chips';

	var padChip = document.createElement('button');
	padChip.type = 'button';
	padChip.className = 'tc-chip';
	padChip.innerHTML = PAD_ICON;
	padChip.setAttribute('aria-label', 'Show or hide the touch controls');
	chips.appendChild(padChip);

	function setPadVisible(visible) {
		root.classList.toggle('tc-off', !visible);
		padChip.dataset.on = visible ? '1' : '0';
		store(STORE_HIDDEN, visible ? '0' : '1');
		if (!visible) releaseAll();
		else measure();
	}

	padChip.addEventListener('click', function (e) {
		e.preventDefault();
		setPadVisible(root.classList.contains('tc-off'));
	});

	if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
		var fullChip = document.createElement('button');
		fullChip.type = 'button';
		fullChip.className = 'tc-chip';
		fullChip.innerHTML = FULL_ICON;
		fullChip.setAttribute('aria-label', 'Toggle fullscreen');
		fullChip.addEventListener('click', function (e) {
			e.preventDefault();
			var doc = document.documentElement;
			var isFull = document.fullscreenElement || document.webkitFullscreenElement;
			try {
				if (isFull) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
				else (doc.requestFullscreen || doc.webkitRequestFullscreen).call(doc);
			} catch (err) {}
		});
		chips.appendChild(fullChip);
	}

	root.appendChild(chips);

	/* ------------------------------------------------------- pointer tracking */

	var pointers = new Map();

	/* Circle hit tests, cached so pointermove never forces a layout. The extra
	   radius only matters once a finger is already down, letting you slide
	   straight from one button to another. */
	function measure() {
		BUTTONS.forEach(function (button) {
			var r = button.el.getBoundingClientRect();
			button.cx = r.left + r.width / 2;
			button.cy = r.top + r.height / 2;
			button.r = Math.min(r.width, r.height) / 2 + 8;
		});
	}

	function setHeld(button, held) {
		if (button.held === held) return;
		button.held = held;
		button.el.dataset.held = held ? '1' : '0';
		sendKey(held ? 'keydown' : 'keyup', button);
		if (held && navigator.vibrate) {
			try { navigator.vibrate(8); } catch (e) {}
		}
	}

	function recompute() {
		BUTTONS.forEach(function (button) {
			var held = false;
			pointers.forEach(function (p) {
				if (held || button.r == null) return;
				var dx = p.x - button.cx;
				var dy = p.y - button.cy;
				if (dx * dx + dy * dy <= button.r * button.r) held = true;
			});
			setHeld(button, held);
		});
	}

	function releaseAll() {
		pointers.clear();
		BUTTONS.forEach(function (button) { setHeld(button, false); });
	}

	BUTTONS.forEach(function (button) {
		button.el.addEventListener('pointerdown', function (e) {
			e.preventDefault();
			/* Drop the implicit capture so a finger can slide between buttons;
			   move/up are handled on window, so events are never lost. */
			try { button.el.releasePointerCapture(e.pointerId); } catch (err) {}
			measure();
			pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
			recompute();
		});
		/* Belt and braces against scroll, long-press menus and double-tap zoom
		   on browsers that treat touch-action loosely. */
		button.el.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
		button.el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
	});

	window.addEventListener('pointermove', function (e) {
		var p = pointers.get(e.pointerId);
		if (!p) return;
		p.x = e.clientX;
		p.y = e.clientY;
		recompute();
	}, { passive: true });

	function endPointer(e) {
		if (!pointers.has(e.pointerId)) return;
		pointers.delete(e.pointerId);
		recompute();
	}

	window.addEventListener('pointerup', endPointer);
	window.addEventListener('pointercancel', endPointer);

	/* Never leave a key stuck down. */
	window.addEventListener('blur', releaseAll);
	document.addEventListener('visibilitychange', function () {
		if (document.hidden) releaseAll();
	});

	window.addEventListener('resize', measure);
	window.addEventListener('orientationchange', function () { setTimeout(measure, 300); });

	/* ------------------------------------------------------------------ hint */

	if (!store(STORE_HINT)) {
		var hint = document.createElement('div');
		hint.className = 'tc-hint';
		hint.textContent = 'Hold left or right to move, tap the big arrow to jump.';
		root.appendChild(hint);
		store(STORE_HINT, '1');
		setTimeout(function () { hint.dataset.fade = '1'; }, 5200);
		setTimeout(function () { hint.remove(); }, 6200);
	}

	/* ----------------------------------------------------------------- mount */

	function mount() {
		document.body.appendChild(root);
		setPadVisible(store(STORE_HIDDEN) !== '1');
		measure();
	}

	if (document.body) mount();
	else document.addEventListener('DOMContentLoaded', mount);
})();
