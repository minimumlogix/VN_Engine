/**
 * particles.js — Ambient Particle Canvas for Loading/Start Screen
 * Minimumlogix Engine v3.1
 * 
 * Draws floating, drifting particles on the #startParticleCanvas element.
 * Particles adapt their color to the active theme's --color-accent CSS variable.
 * Automatically starts/stops to conserve resources when the canvas is not visible.
 */
(function () {
    'use strict';

    let canvas, ctx, W, H;
    let particles = [];
    let rafId = null;
    let running = false;

    const PARTICLE_COUNT = 80;
    const LINE_DISTANCE = 120; // px — max distance to draw connecting lines

    // Resolve the theme accent color from CSS custom properties
    function getAccentColor() {
        const raw = getComputedStyle(document.documentElement)
            .getPropertyValue('--color-accent').trim();
        return raw || '#6cf';
    }

    // Convert CSS color to rgba with given alpha (best-effort)
    function colorWithAlpha(color, alpha) {
        // If it's already rgba/rgb, just rebuild
        const m = color.match(/^#([0-9a-f]{3,6})$/i);
        if (m) {
            const hex = m[1].length === 3
                ? m[1].split('').map(c => c + c).join('')
                : m[1];
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            return `rgba(${r},${g},${b},${alpha})`;
        }
        // fallback: trust browser to handle it (won't apply alpha cleanly but won't crash)
        return color;
    }

    class Particle {
        constructor(accent) {
            this.reset(accent);
        }

        reset(accent) {
            this.x  = Math.random() * W;
            this.y  = Math.random() * H;
            this.vx = (Math.random() - 0.5) * 0.4;
            this.vy = (Math.random() - 0.5) * 0.4;
            this.radius = Math.random() * 1.8 + 0.5;
            this.alpha  = Math.random() * 0.5 + 0.1;
            this.baseAlpha = this.alpha;
            this.accent = accent;
            this.phase  = Math.random() * Math.PI * 2; // for breathing
        }

        update(t) {
            this.x += this.vx;
            this.y += this.vy;

            // Wrap around edges
            if (this.x < -10) this.x = W + 10;
            if (this.x > W + 10) this.x = -10;
            if (this.y < -10) this.y = H + 10;
            if (this.y > H + 10) this.y = -10;

            // Gentle alpha breathing
            this.alpha = this.baseAlpha * (0.7 + 0.3 * Math.sin(t * 0.001 + this.phase));
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = colorWithAlpha(this.accent, this.alpha);
            ctx.fill();
        }
    }

    function init() {
        canvas = document.getElementById('startParticleCanvas');
        if (!canvas) return;

        ctx = canvas.getContext('2d');
        resize();

        const accent = getAccentColor();
        particles = Array.from({ length: PARTICLE_COUNT }, () => new Particle(accent));

        window.addEventListener('resize', resize);
    }

    function resize() {
        if (!canvas) return;
        W = canvas.width  = canvas.offsetWidth  || window.innerWidth;
        H = canvas.height = canvas.offsetHeight || window.innerHeight;
    }

    function drawLines(accent) {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < LINE_DISTANCE) {
                    const alpha = (1 - dist / LINE_DISTANCE) * 0.12;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = colorWithAlpha(accent, alpha);
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }

    function loop(t) {
        if (!running || !canvas) return;
        rafId = requestAnimationFrame(loop);

        ctx.clearRect(0, 0, W, H);

        const accent = getAccentColor();

        // Update & draw particles
        particles.forEach(p => {
            p.accent = accent; // refresh accent in case theme changed
            p.update(t);
            p.draw();
        });

        drawLines(accent);
    }

    function start() {
        if (running) return;
        running = true;
        rafId = requestAnimationFrame(loop);
    }

    function stop() {
        running = false;
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    // Auto-start when DOM is available
    function tryStart() {
        init();
        if (canvas) {
            start();
        } else {
            // Canvas not in DOM yet, wait for it
            const observer = new MutationObserver(() => {
                const c = document.getElementById('startParticleCanvas');
                if (c) {
                    observer.disconnect();
                    init();
                    start();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    // Stop particles when the loading screen hides (performance)
    function watchLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (!loadingScreen) return;

        const observer = new MutationObserver(() => {
            const isHidden = loadingScreen.style.display === 'none' ||
                              loadingScreen.classList.contains('fade-out');
            if (isHidden) {
                stop();
                observer.disconnect();
            }
        });
        observer.observe(loadingScreen, { attributes: true, attributeFilter: ['style', 'class'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            tryStart();
            watchLoadingScreen();
        });
    } else {
        tryStart();
        watchLoadingScreen();
    }
})();
