// nexus_macros.js — Cinematic Macro Runtime
// Mirrors Effect_List.md. Add new macros here without touching editor logic.

const NEXUS_MACROS = [
    { name: 'shake',        icon: '📳', duration: 600,  desc: 'Rapid screen shake',                    intensitySupport: true },
    { name: 'glitch',       icon: '📡', duration: 1800, desc: 'Digital artifacting & displacement',    intensitySupport: true },
    { name: 'flash',        icon: '⚡', duration: 200,  desc: 'Single white frame flash',              intensitySupport: true },
    { name: 'blink',        icon: '👁', duration: 1400, desc: 'Repeated black-out eye blink',          intensitySupport: true },
    { name: 'electricuted', icon: '🌩', duration: 1200, desc: 'High-frequency jitter with blue tint',  intensitySupport: true },
    { name: 'shadows',      icon: '🌑', duration: 2200, desc: 'Vignette darkens and pulses',           intensitySupport: true },
    { name: 'earthquake',   icon: '🌍', duration: 1800, desc: 'Low-frequency heavy screen rocking',    intensitySupport: true },
    { name: 'heartbeat',    icon: '💗', duration: 1600, desc: 'Double-thump zoom pulse',               intensitySupport: true },
    { name: 'vhs',          icon: '📼', duration: 2500, desc: 'Analog distortion & tracking lines',    intensitySupport: true },
    { name: 'drain',        icon: '🩶', duration: 2000, desc: 'Colors drain to grayscale',             intensitySupport: true },
    { name: 'nuke',         icon: '☢️', duration: 3000, desc: 'White flash then shockwave',             intensitySupport: true },
    { name: 'bloodsplatter',icon: '🩸', duration: 1600, desc: 'Red vignette pulse',                    intensitySupport: true },
    { name: 'shockwave',    icon: '💥', duration: 1000, desc: 'Single radial ripple distortion',       intensitySupport: true },
    { name: 'hologram',     icon: '🔵', duration: 3000, desc: 'Blue tint with horizontal flickering',  intensitySupport: true },
    { name: 'rage',         icon: '😤', duration: 2000, desc: 'Red-tinted violent shaking',             intensitySupport: true },
];

// Text macros ({{user}} style)
const NEXUS_TEXT_MACROS = [
    { name: 'user', token: '{{user}}', desc: "The player's name. Defaults to \"Player\"." },
];

window.NEXUS_MACROS = NEXUS_MACROS;
window.NEXUS_TEXT_MACROS = NEXUS_TEXT_MACROS;

/**
 * Creates a styled, non-editable inline macro token DOM element.
 * @param {string} name - Macro name (e.g. "shake")
 * @param {number|null} intensity - Optional intensity 1-3
 * @returns {HTMLElement}
 */
function createMacroToken(name, intensity) {
    const macro = NEXUS_MACROS.find(m => m.name === name);
    const icon = macro ? macro.icon : '⚙️';

    const span = document.createElement('span');
    span.contentEditable = 'false';
    span.className = 'nexus-macro-token';
    span.dataset.macro = name;
    span.dataset.intensity = intensity != null ? String(intensity) : '';
    span.setAttribute('draggable', 'false');

    const label = intensity ? `${icon} ${name}(${intensity})` : `${icon} ${name}`;
    span.textContent = label;

    // Click to delete
    span.title = `${macro ? macro.desc : name} — Click to remove`;
    span.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    span.addEventListener('click', (e) => {
        e.stopPropagation();
        // Select the token and delete it
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNode(span);
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand('delete');
    });

    return span;
}

/**
 * Serializes all macro tokens within a container to their text format.
 * Called during content serialization.
 * @param {string} name
 * @param {string|number|null} intensity
 * @returns {string}  e.g. "[shake(2)]" or "[shake]"
 */
function macroToText(name, intensity) {
    if (intensity) return `[${name}(${intensity})]`;
    return `[${name}]`;
}

window.createMacroToken = createMacroToken;
window.macroToText = macroToText;
