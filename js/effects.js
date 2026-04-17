/* ================================================================
   effects.js — LVNE Effects Engine (v4.0 — GODMODE Upgrade)
   ================================================================
   Macro Effects (short-term, body-class):
     shake, glitch, flash, blink, electricuted, shadows,
     earthquake, heartbeat, vhs, drain, nuke, bloodsplatter,
     shockwave, hologram, rage

   Overlay Effects (full-screen blocking):
     GLITCH, ELECTROCUTED, NUKE, SHOCKWAVE, PORTAL

   Persistent Layer: GIF/media overlays per scene node
   ================================================================ */

class EffectsEngine {
    constructor() {
        this.persistentLayer = document.getElementById('persistentEffectLayer');
        this.overlayLayer    = document.getElementById('effectOverlay');

        // ── Macro effects — applied as CSS classes on <body> ─────────────
        // intensity: 1=default, 2=strong, 3=violent (scales CSS var --fx-intensity)
        this.macros = {
            /* ── EXISTING (perfected) ── */
            'shake':        { class: 'fx-shake',        duration: 600  },
            'glitch':       { class: 'fx-glitch',       duration: 1800 },
            'flash':        { class: 'fx-flash',        duration: 200  },
            'blink':        { class: 'fx-blink',        duration: 1400 },
            'electricuted': { class: 'fx-electricuted', duration: 1200 },
            'shadows':      { class: 'fx-shadows',      duration: 2200 },

            /* ── NEW EFFECTS ── */
            'earthquake':   { class: 'fx-earthquake',   duration: 1800 }, // low-freq violent shake
            'heartbeat':    { class: 'fx-heartbeat',    duration: 1600 }, // double-thump zoom pulse
            'vhs':          { class: 'fx-vhs',          duration: 2500 }, // analog VHS distortion
            'drain':        { class: 'fx-drain',        duration: 2000 }, // colour drains to mono
            'nuke':         { class: 'fx-nuke',         duration: 3000 }, // white flash → shockwave
            'bloodsplatter':{ class: 'fx-bloodsplatter',duration: 1600 }, // red vignette burst
            'shockwave':    { class: 'fx-shockwave',    duration: 1000 }, // radial ripple
            'hologram':     { class: 'fx-hologram',     duration: 3000 }, // flickering hologram lines
            'rage':         { class: 'fx-rage',         duration: 2000 }, // red-tinted violent shake
        };

        // ── Legacy / blocking overlay effects ───────────────────────────
        this.overlayEffects = {
            GLITCH: {
                duration: 2000,
                build: (el) => {
                    el.classList.add('fxov-glitch');
                    el.innerHTML = `
                        <div class="fxov-glitch-bar"></div>
                        <div class="fxov-glitch-bar"></div>
                        <div class="fxov-glitch-bar"></div>
                        <div class="fxov-glitch-scan"></div>
                    `;
                }
            },
            ELECTROCUTED: {
                duration: 1500,
                build: (el) => {
                    el.classList.add('fxov-electrocuted');
                    // Canvas-powered lightning arcs
                    const canvas = document.createElement('canvas');
                    canvas.width  = window.innerWidth;
                    canvas.height = window.innerHeight;
                    canvas.className = 'fxov-lightning-canvas';
                    el.appendChild(canvas);
                    this._drawLightning(canvas, 12);
                }
            },
            NUKE: {
                duration: 3500,
                build: (el) => {
                    el.classList.add('fxov-nuke');
                    el.innerHTML = `<div class="fxov-nuke-flash"></div><div class="fxov-nuke-ring"></div><div class="fxov-nuke-ring fxov-nuke-ring--2"></div>`;
                }
            },
            SHOCKWAVE: {
                duration: 1200,
                build: (el) => {
                    el.classList.add('fxov-shockwave');
                    el.innerHTML = `<div class="fxov-shockwave-ring"></div>`;
                }
            },
            PORTAL: {
                duration: 2800,
                build: (el) => {
                    el.classList.add('fxov-portal');
                    el.innerHTML = `
                        <div class="fxov-portal-ring fxov-portal-ring--1"></div>
                        <div class="fxov-portal-ring fxov-portal-ring--2"></div>
                        <div class="fxov-portal-ring fxov-portal-ring--3"></div>
                        <div class="fxov-portal-core"></div>
                    `;
                }
            }
        };

        // ── Private state ─────────────────────────────────────────────────
        this._queue    = [];
        this._running  = false;
        this._activeMacroTimers = new Map();

        if (typeof appLogger !== 'undefined') {
            appLogger.info('EffectsEngine v4.0 initialised — GODMODE');
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  PUBLIC API
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Fire a named macro effect on <body>.
     * @param {string} name   - Macro key (e.g. 'shake', 'vhs')
     * @param {object} [opts] - { intensity: 1|2|3, duration?: ms }
     */
    triggerMacro(name, opts = {}) {
        const macro = this.macros[name];
        if (!macro) {
            if (typeof appLogger !== 'undefined') appLogger.warn(`[FX] Unknown macro: '${name}'`);
            return;
        }

        const intensity = Math.min(3, Math.max(1, opts.intensity || 1));
        const duration  = opts.duration || macro.duration;

        if (typeof appLogger !== 'undefined') appLogger.info(`[FX] Macro: ${name} (intensity ${intensity})`);

        // Cancel existing timer for this class if re-triggered
        if (this._activeMacroTimers.has(macro.class)) {
            clearTimeout(this._activeMacroTimers.get(macro.class));
        }

        document.body.style.setProperty('--fx-intensity', intensity);
        document.body.classList.remove(macro.class);
        void document.body.offsetWidth; // force reflow to restart animation
        document.body.classList.add(macro.class);

        const timer = setTimeout(() => {
            document.body.classList.remove(macro.class);
            this._activeMacroTimers.delete(macro.class);
        }, duration);

        this._activeMacroTimers.set(macro.class, timer);
    }

    /**
     * Play a full-screen blocking overlay effect. Returns a Promise that
     * resolves when the effect completes (so scene can advance).
     * @param {string}   name     - Overlay effect key (e.g. 'GLITCH')
     * @param {function} callback - Optional legacy callback
     */
    playOverlayEffect(name, callback) {
        const def = this.overlayEffects[name];
        if (!def) {
            if (typeof appLogger !== 'undefined') appLogger.warn(`[FX] Unknown overlay: '${name}'`);
            if (callback) callback();
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            if (typeof appLogger !== 'undefined') appLogger.info(`[FX] Overlay: ${name}`);

            this.overlayLayer.style.display = 'block';
            this.overlayLayer.innerHTML = '';
            this.overlayLayer.className = 'effect-overlay';
            def.build(this.overlayLayer);

            setTimeout(() => {
                this.overlayLayer.style.display = 'none';
                this.overlayLayer.className = 'effect-overlay';
                this.overlayLayer.innerHTML = '';
                if (callback) callback();
                resolve();
            }, def.duration);
        });
    }

    /**
     * Play multiple macros in sequence.
     * @param {Array<{name:string, opts?:object, gap?:number}>} steps
     */
    playSequence(steps) {
        let delay = 0;
        steps.forEach(step => {
            setTimeout(() => this.triggerMacro(step.name, step.opts || {}), delay);
            delay += (step.opts?.duration || this.macros[step.name]?.duration || 1000) + (step.gap || 0);
        });
    }

    // ── Persistent Layer ─────────────────────────────────────────────────

    setPersistentEffect(effectUrl) {
        if (effectUrl === undefined) return;
        if (effectUrl === '') { this.clearPersistentEffect(); return; }

        this.persistentLayer.style.display = 'block';
        this.persistentLayer.innerHTML =
            `<img src="${effectUrl}" class="persistent-effect-img" alt="effect layer">`;

        if (typeof appLogger !== 'undefined') appLogger.info(`[FX] Persistent layer set: ${effectUrl}`);
    }

    clearPersistentEffect() {
        this.persistentLayer.style.display = 'none';
        this.persistentLayer.innerHTML = '';
    }

    /**
     * Walk back through story data to find the most recent persistentEffect declaration.
     */
    resolveEffectForIndex(index, runtimeStoryData) {
        if (!runtimeStoryData) return '';
        for (let i = index; i >= 0; i--) {
            const d = runtimeStoryData[i];
            if (d.persistentEffect !== undefined) return d.persistentEffect;
        }
        return '';
    }

    // ── Cleanup ───────────────────────────────────────────────────────────

    cleanup() {
        this.clearPersistentEffect();

        // Hide overlay
        if (this.overlayLayer) {
            this.overlayLayer.style.display = 'none';
            this.overlayLayer.className = 'effect-overlay';
            this.overlayLayer.innerHTML = '';
        }

        // Clear all active macro timers
        this._activeMacroTimers.forEach((timer) => clearTimeout(timer));
        this._activeMacroTimers.clear();

        // Remove all macro classes from body
        Object.values(this.macros).forEach(m => document.body.classList.remove(m.class));
        document.body.style.removeProperty('--fx-intensity');
    }

    // ══════════════════════════════════════════════════════════════════════
    //  CANVAS UTILITIES
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Draw procedural lightning arcs on a canvas element.
     */
    _drawLightning(canvas, bolts = 6) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        let frame = 0;
        const MAX_FRAMES = 40;

        const drawBolt = (x1, y1, x2, y2, roughness, depth) => {
            if (depth <= 0) return;
            const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * roughness;
            const my = (y1 + y2) / 2 + (Math.random() - 0.5) * roughness;
            drawBolt(x1, y1, mx, my, roughness / 2, depth - 1);
            drawBolt(mx, my, x2, y2, roughness / 2, depth - 1);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(mx, my);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = `rgba(${100 + Math.random() * 155}, 220, 255, ${0.4 + Math.random() * 0.6})`;
            ctx.lineWidth = depth * 0.8;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00cfff';
            ctx.stroke();
        };

        const render = () => {
            ctx.clearRect(0, 0, W, H);
            if (frame % 2 === 0) { // flicker every other frame
                for (let i = 0; i < bolts; i++) {
                    drawBolt(
                        Math.random() * W, 0,
                        Math.random() * W, H,
                        W * 0.3, 6
                    );
                }
            }
            frame++;
            if (frame < MAX_FRAMES) requestAnimationFrame(render);
        };
        requestAnimationFrame(render);
    }
}

// ── Global singleton ────────────────────────────────────────────────────────
const effectsEngine = new EffectsEngine();
