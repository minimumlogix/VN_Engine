class EffectsEngine {
    constructor() {
        this.persistentLayer = document.getElementById('persistentEffectLayer');
        this.overlayLayer = document.getElementById('effectOverlay');

        // Pre-configured macro effects for dialogue
        this.macros = {
            'shake': { class: 'shake-effect', duration: 500 },
            'glitch': { class: 'glitch-effect', duration: 1500 },
            'flash': { class: 'flash-effect', duration: 150 },
            'blink': { class: 'blink-effect', duration: 1200 },
            'electricuted': { class: 'electricuted-effect', duration: 1000 },
            'shadows': { class: 'shadows-effect', duration: 2000 }
        };

        // Legacy full-screen effects dictionary (for blocking scene progression)
        this.legacyEffects = {
            GLITCH: {
                duration: 2000,
                cssClass: 'glitch-overlay',
                animate: (element) => {
                    element.classList.add('glitch-overlay');
                    element.innerHTML = `
                        <div class="glitch-1">GLITCH</div>
                        <div class="glitch-2">GLITCH</div>
                        <div class="glitch-3">GLITCH</div>
                    `;
                }
            },
            ELECTROCUTED: {
                duration: 1500,
                cssClass: 'electrocuted-overlay',
                animate: (element) => {
                    element.classList.add('electrocuted-overlay');
                    element.innerHTML = `<div class="lightning"></div>`;
                }
            }
        };
    }

    // --- Method 1: Macro Effects ---
    triggerMacro(macroName) {
        if (!this.macros[macroName]) {
            if (typeof appLogger !== 'undefined') appLogger.warn(`Macro effect '${macroName}' not found`);
            return;
        }
        
        const effect = this.macros[macroName];
        if (typeof appLogger !== 'undefined') appLogger.info(`Triggering visual macro: ${macroName}`);
        
        // Remove and re-add class to restart animation if triggered rapidly
        document.body.classList.remove(effect.class);
        void document.body.offsetWidth; // trigger reflow
        document.body.classList.add(effect.class);

        setTimeout(() => {
            document.body.classList.remove(effect.class);
        }, effect.duration);
    }

    // --- Method 2: Persistent Layer (GIF Method) ---
    setPersistentEffect(effectUrl) {
        if (effectUrl === undefined) return;

        if (effectUrl === "") {
            this.clearPersistentEffect();
            return;
        }

        this.persistentLayer.style.display = 'block';
        this.persistentLayer.innerHTML = `<img src="${effectUrl}" class="persistent-effect-img" alt="effect layer">`;
    }

    clearPersistentEffect() {
        this.persistentLayer.style.display = 'none';
        this.persistentLayer.innerHTML = '';
    }

    resolveEffectForIndex(index, runtimeStoryData) {
        if (!runtimeStoryData) return "";
        for (let i = index; i >= 0; i--) {
            const d = runtimeStoryData[i];
            if (d.persistentEffect !== undefined) {
                return d.persistentEffect; // Could be URL or "" to clear
            }
        }
        return "";
    }

    // --- Method 3: Screen Overlay Effects (Blocking) ---
    playOverlayEffect(effectName, callback) {
        if (!this.legacyEffects[effectName]) {
            console.error(`Effect ${effectName} not found`);
            if (callback) callback();
            return;
        }

        const effect = this.legacyEffects[effectName];
        this.overlayLayer.className = `effect-overlay ${effect.cssClass}`;
        this.overlayLayer.style.display = 'block';
        effect.animate(this.overlayLayer);

        setTimeout(() => {
            this.overlayLayer.style.display = 'none';
            this.overlayLayer.className = 'effect-overlay';
            this.overlayLayer.innerHTML = '';
            if (callback) callback();
        }, effect.duration);
    }

    // Cleanup all visual effects
    cleanup() {
        this.clearPersistentEffect();
        if (this.overlayLayer) {
            this.overlayLayer.style.display = 'none';
            this.overlayLayer.className = 'effect-overlay';
            this.overlayLayer.innerHTML = '';
        }
        
        // Remove all macro classes from body
        Object.values(this.macros).forEach(macro => {
            document.body.classList.remove(macro.class);
        });
    }
}

// Instantiate globally
const effectsEngine = new EffectsEngine();
