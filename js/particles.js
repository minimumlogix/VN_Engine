/**
 * particles.js — Ambient Particle Canvas for Loading/Start Screen
 * Minimumlogix Engine v3.1
 * 
 * Now refactored as a proper class-based system with public API.
 * Draws floating, drifting particles on the #startParticleCanvas element.
 * Particles adapt their color to the active theme's --color-accent CSS variable.
 * Automatically starts/stops to conserve resources when the canvas is not visible.
 */

/**
 * ParticleSystem — Manages ambient particles on a canvas
 */
class ParticleSystem {
    constructor(canvasId = 'startParticleCanvas', config = null) {
        this.canvasId = canvasId;
        this.canvas = null;
        this.ctx = null;
        this.W = 0;
        this.H = 0;
        this.particles = [];
        this.rafId = null;
        this.running = false;
        this._mutationObserver = null;
        this._screenObserver = null;

        // Use ENGINE_CONFIG if available, otherwise fallback
        const cfg = config || (typeof ENGINE_CONFIG !== 'undefined' ? ENGINE_CONFIG.particles : null);
        this.config = {
            particleCount: cfg?.count ?? 80,
            lineDistance: cfg?.lineDistance ?? 120,
            velocityRange: cfg?.velocityRange ?? 0.4,
            radiusRange: cfg?.radiusRange ?? { min: 0.5, max: 1.8 },
            alphaRange: cfg?.alphaRange ?? { min: 0.1, max: 0.6 },
            breathingIntensity: cfg?.breathingIntensity ?? 0.3,
        };

        // Auto-initialize on construction
        this._tryInit();
    }

    /**
     * Helper: Get theme accent color from CSS
     */
    getAccentColor() {
        const raw = getComputedStyle(document.documentElement)
            .getPropertyValue('--color-accent').trim();
        return raw || '#6cf';
    }

    /**
     * Helper: Convert hex color to rgba
     */
    colorWithAlpha(color, alpha) {
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
        return color;
    }

    /**
     * Initialize the particle system
     */
    init() {
        this.canvas = document.getElementById(this.canvasId);
        if (!this.canvas) {
            console.warn(`[ParticleSystem] Canvas "${this.canvasId}" not found`);
            return false;
        }

        this.ctx = this.canvas.getContext('2d');
        this._resize();

        const accent = this.getAccentColor();
        this.particles = Array.from(
            { length: this.config.particleCount },
            () => new ParticleSystem.Particle(this.config, accent)
        );

        window.addEventListener('resize', () => this._resize());
        return true;
    }

    /**
     * Resize canvas to match container
     */
    _resize() {
        if (!this.canvas) return;
        this.W = this.canvas.width = this.canvas.offsetWidth || window.innerWidth;
        this.H = this.canvas.height = this.canvas.offsetHeight || window.innerHeight;

        // Update particle bounds
        this.particles.forEach(p => p.setBounds(this.W, this.H));
    }

    /**
     * Draw connecting lines between nearby particles
     */
    _drawLines(accent) {
        const ld = this.config.lineDistance;
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < ld) {
                    const alpha = (1 - dist / ld) * 0.12;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.strokeStyle = this.colorWithAlpha(accent, alpha);
                    this.ctx.lineWidth = 0.5;
                    this.ctx.stroke();
                }
            }
        }
    }

    /**
     * Main animation loop
     */
    _loop = (t) => {
        if (!this.running || !this.canvas) return;
        this.rafId = requestAnimationFrame(this._loop);

        this.ctx.clearRect(0, 0, this.W, this.H);

        const accent = this.getAccentColor();

        // Update & draw particles
        this.particles.forEach(p => {
            p.accent = accent;
            p.update(t);
            p.draw(this.ctx, this.colorWithAlpha.bind(this));
        });

        this._drawLines(accent);
    };

    /**
     * Start the animation
     */
    start() {
        if (this.running) return;
        this.running = true;
        this.rafId = requestAnimationFrame(this._loop);
    }

    /**
     * Stop the animation and clean up
     */
    stop() {
        this.running = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    /**
     * Try to initialize, with fallback for DOM not ready
     */
    _tryInit() {
        if (this.init()) {
            this.start();
            this._watchLoadingScreen();
        } else {
            // Canvas not in DOM yet, wait for it
            this._mutationObserver = new MutationObserver(() => {
                if (this.init()) {
                    this.start();
                    this._watchLoadingScreen();
                    if (this._mutationObserver) {
                        this._mutationObserver.disconnect();
                        this._mutationObserver = null;
                    }
                }
            });
            this._mutationObserver.observe(document.body, { childList: true, subtree: true });
        }
    }

    /**
     * Watch loading screen and stop particles when it hides
     */
    _watchLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (!loadingScreen) return;

        this._screenObserver = new MutationObserver(() => {
            const isHidden = loadingScreen.style.display === 'none' ||
                              loadingScreen.classList.contains('fade-out');
            if (isHidden) {
                this.stop();
                if (this._screenObserver) {
                    this._screenObserver.disconnect();
                    this._screenObserver = null;
                }
            }
        });
        this._screenObserver.observe(loadingScreen, {
            attributes: true,
            attributeFilter: ['style', 'class']
        });
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.stop();
        if (this._mutationObserver) {
            this._mutationObserver.disconnect();
            this._mutationObserver = null;
        }
        if (this._screenObserver) {
            this._screenObserver.disconnect();
            this._screenObserver = null;
        }
        this.particles = [];
        this.canvas = null;
        this.ctx = null;
    }

    /**
     * Get system status for debugging
     */
    getStatus() {
        return {
            running: this.running,
            canvasId: this.canvasId,
            particleCount: this.particles.length,
            canvasSize: { width: this.W, height: this.H },
        };
    }
}

/**
 * Individual particle class
 */
ParticleSystem.Particle = class Particle {
    constructor(config, accent) {
        this.config = config;
        this.accent = accent;
        this.W = window.innerWidth;
        this.H = window.innerHeight;
        this.reset();
    }

    reset() {
        this.x = Math.random() * this.W;
        this.y = Math.random() * this.H;
        this.vx = (Math.random() - 0.5) * this.config.velocityRange;
        this.vy = (Math.random() - 0.5) * this.config.velocityRange;
        this.radius = Math.random() * (this.config.radiusRange.max - this.config.radiusRange.min) + this.config.radiusRange.min;
        this.alpha = Math.random() * (this.config.alphaRange.max - this.config.alphaRange.min) + this.config.alphaRange.min;
        this.baseAlpha = this.alpha;
        this.phase = Math.random() * Math.PI * 2;
    }

    setBounds(w, h) {
        this.W = w;
        this.H = h;
    }

    update(t) {
        this.x += this.vx;
        this.y += this.vy;

        // Wrap around edges
        if (this.x < -10) this.x = this.W + 10;
        if (this.x > this.W + 10) this.x = -10;
        if (this.y < -10) this.y = this.H + 10;
        if (this.y > this.H + 10) this.y = -10;

        // Gentle alpha breathing
        this.alpha = this.baseAlpha * (0.7 + this.config.breathingIntensity * Math.sin(t * 0.001 + this.phase));
    }

    draw(ctx, colorWithAlpha) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = colorWithAlpha(this.accent, this.alpha);
        ctx.fill();
    }
};

/**
 * Global instance — auto-initializes
 */
const particleSystem = new ParticleSystem('startParticleCanvas');

// Auto-start on DOM ready if needed
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!particleSystem.running) {
            particleSystem._tryInit();
        }
    });
}
