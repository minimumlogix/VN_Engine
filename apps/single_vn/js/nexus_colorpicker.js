/**
 * nexus_colorpicker.js — AAA Premium Color Wheel Overhaul
 * Local version for Intro Architect (single_vn)
 */

(function () {
    const RECENT_KEY = 'nexus_recent_colors_v2';
    const MAX_RECENT = 5;

    const DEFAULT_PALETTE = [
        '#00F3FF', '#00FF88', '#FFCC00', '#FF4757', '#8844FF', '#FFFFFF'
    ];

    let recentColors = [];
    try { recentColors = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { recentColors = []; }

    function saveRecent(hex) {
        hex = hex.toUpperCase();
        recentColors = [hex, ...recentColors.filter(c => c !== hex)].slice(0, MAX_RECENT);
        try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentColors)); } catch (e) {}
    }

    // --- UTILS ---
    function hsvToRgb(h, s, v) {
        const f = (n) => {
            const k = (n + h / 60) % 6;
            return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
        };
        return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
    }

    function rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const d = max - min;
        let h = 0, s = max === 0 ? 0 : d / max, v = max;
        if (d !== 0) {
            if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60;
        }
        return [h, s, v];
    }

    function hexToRgb(hex) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const n = parseInt(hex, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }

    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    // --- PICKER STATE ---
    let pickerEl = null;
    let state = { h: 0, s: 1, v: 1 };
    let activeOnChange = null;
    let activeOnClose = null;
    let dragging = null; // 'hue', 'sv', 'vbar'

    function buildPicker() {
        const el = document.createElement('div');
        el.id = 'nexus-color-picker';
        el.className = 'nexus-color-picker';
        el.setAttribute('data-ignore-close', 'true');
        el.innerHTML = `
            <div class="ncp-header">
                <span class="ncp-title">Precision Color Wheel</span>
                <span class="ncp-close">&times;</span>
            </div>
            <div class="ncp-wheel-container">
                <canvas class="ncp-hue-canvas" width="440" height="440" style="width: 220px; height: 220px;"></canvas>
                <div class="ncp-hue-cursor"></div>
                <div class="ncp-sv-container">
                    <canvas class="ncp-sv-canvas" width="220" height="220" style="width: 110px; height: 110px;"></canvas>
                    <div class="ncp-sv-cursor"></div>
                </div>
            </div>
            
            <div class="ncp-v-bar">
                <canvas class="ncp-v-canvas" width="440" height="20" style="width: 220px; height: 10px;"></canvas>
                <div class="ncp-v-cursor"></div>
            </div>

            <div class="ncp-preview-row">
                <div class="ncp-preview-swatch"></div>
                <div class="ncp-inputs">
                    <div class="ncp-hex-row" style="display: flex; gap: 4px; width: 100%;">
                        <input class="ncp-hex-input" type="text" maxlength="7" placeholder="#FFFFFF" spellcheck="false" style="flex: 1;">
                        <button class="ncp-copy-btn" title="Copy Hex" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 8px; padding: 0 8px; cursor: pointer;"><i class="bi bi-clipboard"></i></button>
                    </div>
                    <div class="ncp-rgb-row">
                        <input class="ncp-r" type="number" min="0" max="255" placeholder="R">
                        <input class="ncp-g" type="number" min="0" max="255" placeholder="G">
                        <input class="ncp-b" type="number" min="0" max="255" placeholder="B">
                    </div>
                </div>
                <button class="ncp-apply-btn">OK</button>
            </div>

            <div class="ncp-section-label">RECENT & PALETTE</div>
            <div class="ncp-grid ncp-palette"></div>
        `;
        document.body.appendChild(el);
        return el;
    }

    function drawHue(canvas) {
        const ctx = canvas.getContext('2d');
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const outer = canvas.width / 2;
        const inner = outer - 40;

        for (let i = 0; i < 360; i++) {
            const startAngle = (i - 0.5) * Math.PI / 180;
            const endAngle = (i + 0.5) * Math.PI / 180;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, outer, startAngle, endAngle);
            ctx.closePath();
            const [r, g, b] = hsvToRgb(i, 1, 1);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fill();
        }

        // Clip the middle
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(cx, cy, inner, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }

    function drawSV(canvas, hue) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const [r, g, b] = hsvToRgb(hue, 1, 1);
        const hueColor = `rgb(${r},${g},${b})`;

        const lgH = ctx.createLinearGradient(0, 0, w, 0);
        lgH.addColorStop(0, '#fff');
        lgH.addColorStop(1, hueColor);
        ctx.fillStyle = lgH;
        ctx.fillRect(0, 0, w, h);

        const lgV = ctx.createLinearGradient(0, 0, 0, h);
        lgV.addColorStop(0, 'transparent');
        lgV.addColorStop(1, '#000');
        ctx.fillStyle = lgV;
        ctx.fillRect(0, 0, w, h);
    }

    function drawVBar(canvas, hue, s) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        const lg = ctx.createLinearGradient(0, 0, w, 0);
        const [r, g, b] = hsvToRgb(hue, s, 1);
        lg.addColorStop(0, '#000');
        lg.addColorStop(1, `rgb(${r},${g},${b})`);
        ctx.fillStyle = lg;
        ctx.fillRect(0, 0, w, h);
    }

    function updateCursors() {
        // Hue cursor
        const angle = state.h * Math.PI / 180;
        const radius = 97.5; // (85 + 110) / 2
        const cx = 110, cy = 110;
        const hCursor = pickerEl.querySelector('.ncp-hue-cursor');
        hCursor.style.left = (cx + Math.cos(angle) * radius) + 'px';
        hCursor.style.top = (cy + Math.sin(angle) * radius) + 'px';

        // SV cursor
        const svCursor = pickerEl.querySelector('.ncp-sv-cursor');
        svCursor.style.left = (state.s * 110) + 'px';
        svCursor.style.top = ((1 - state.v) * 110) + 'px';

        // V cursor
        const vCursor = pickerEl.querySelector('.ncp-v-cursor');
        vCursor.style.left = (state.v * 220) + 'px';
    }

    function updateUI(skipInputs = false) {
        const svCanvas = pickerEl.querySelector('.ncp-sv-canvas');
        const vCanvas = pickerEl.querySelector('.ncp-v-canvas');
        drawSV(svCanvas, state.h);
        drawVBar(vCanvas, state.h, state.s);
        updateCursors();

        const [r, g, b] = hsvToRgb(state.h, state.s, state.v);
        const hex = rgbToHex(r, g, b);
        pickerEl.querySelector('.ncp-preview-swatch').style.background = hex;
        
        if (!skipInputs) {
            pickerEl.querySelector('.ncp-hex-input').value = hex;
            pickerEl.querySelector('.ncp-r').value = r;
            pickerEl.querySelector('.ncp-g').value = g;
            pickerEl.querySelector('.ncp-b').value = b;
        }

        if (activeOnChange) activeOnChange(hex);
    }

    function setColor(hex) {
        try {
            const [r, g, b] = hexToRgb(hex);
            const [h, s, v] = rgbToHsv(r, g, b);
            state = { h, s, v };
            updateUI();
        } catch (e) {}
    }

    function buildPalette() {
        const grid = pickerEl.querySelector('.ncp-grid');
        grid.innerHTML = '';
        
        // Combine Default + Recent
        const combined = [...new Set([...recentColors, ...DEFAULT_PALETTE])].slice(0, 12);
        
        combined.forEach(hex => {
            const sw = document.createElement('div');
            sw.className = 'ncp-swatch';
            sw.style.background = hex;
            sw.title = hex;
            sw.addEventListener('mousedown', e => {
                e.preventDefault();
                setColor(hex);
            });
            grid.appendChild(sw);
        });
    }

    function attachEvents() {
        const hueCanvas = pickerEl.querySelector('.ncp-hue-canvas');
        const svContainer = pickerEl.querySelector('.ncp-sv-container');
        const vBar = pickerEl.querySelector('.ncp-v-bar');
        const hexInput = pickerEl.querySelector('.ncp-hex-input');

        function handleHue(e) {
            const rect = hueCanvas.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
            state.h = (angle * 180 / Math.PI + 360) % 360;
            updateUI();
        }

        function handleSV(e) {
            const rect = svContainer.getBoundingClientRect();
            const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
            const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
            state.s = x;
            state.v = 1 - y;
            updateUI();
        }

        function handleV(e) {
            const rect = vBar.getBoundingClientRect();
            const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
            state.v = x;
            updateUI();
        }

        hueCanvas.addEventListener('mousedown', e => { dragging = 'hue'; handleHue(e); e.preventDefault(); });
        svContainer.addEventListener('mousedown', e => { dragging = 'sv'; handleSV(e); e.preventDefault(); });
        vBar.addEventListener('mousedown', e => { dragging = 'v'; handleV(e); e.preventDefault(); });

        // Touch support
        hueCanvas.addEventListener('touchstart', e => { dragging = 'hue'; handleHue(e.touches[0]); e.preventDefault(); }, {passive:false});
        svContainer.addEventListener('touchstart', e => { dragging = 'sv'; handleSV(e.touches[0]); e.preventDefault(); }, {passive:false});
        vBar.addEventListener('touchstart', e => { dragging = 'v'; handleV(e.touches[0]); e.preventDefault(); }, {passive:false});

        window.addEventListener('mousemove', e => {
            if (!dragging) return;
            if (dragging === 'hue') handleHue(e);
            if (dragging === 'sv') handleSV(e);
            if (dragging === 'v') handleV(e);
        });

        window.addEventListener('touchmove', e => {
            if (!dragging) return;
            if (dragging === 'hue') handleHue(e.touches[0]);
            if (dragging === 'sv') handleSV(e.touches[0]);
            if (dragging === 'v') handleV(e.touches[0]);
            e.preventDefault();
        }, {passive:false});

        window.addEventListener('mouseup', () => { dragging = null; });
        window.addEventListener('touchend', () => { dragging = null; });

        // RGB Inputs
        ['ncp-r', 'ncp-g', 'ncp-b'].forEach(cls => {
            pickerEl.querySelector('.' + cls).addEventListener('input', () => {
                const r = parseInt(pickerEl.querySelector('.ncp-r').value) || 0;
                const g = parseInt(pickerEl.querySelector('.ncp-g').value) || 0;
                const b = parseInt(pickerEl.querySelector('.ncp-b').value) || 0;
                setColor(rgbToHex(clamp(r,0,255), clamp(g,0,255), clamp(b,0,255)));
            });
        });

        hexInput.addEventListener('input', e => {
            const val = e.target.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(val) || /^#[0-9a-fA-F]{3}$/.test(val)) {
                setColor(val);
            }
        });

        pickerEl.querySelector('.ncp-apply-btn').addEventListener('click', () => {
            const [r, g, b] = hsvToRgb(state.h, state.s, state.v);
            const hex = rgbToHex(r, g, b);
            saveRecent(hex);
            if (activeOnChange) activeOnChange(hex);
            close();
        });

        pickerEl.querySelector('.ncp-copy-btn').addEventListener('click', () => {
            const hex = pickerEl.querySelector('.ncp-hex-input').value;
            navigator.clipboard.writeText(hex).then(() => {
                const btn = pickerEl.querySelector('.ncp-copy-btn');
                const old = btn.innerHTML;
                btn.innerHTML = '<i class="bi bi-check"></i>';
                setTimeout(() => btn.innerHTML = old, 1500);
            });
        });

        pickerEl.querySelector('.ncp-close').addEventListener('click', close);

        // Prevent closing when clicking inside
        pickerEl.addEventListener('mousedown', e => e.stopPropagation());
    }

    function open(anchorEl, initialColor, onChange, onClose) {
        activeOnChange = null;
        activeOnClose = onClose;

        if (!pickerEl) {
            pickerEl = buildPicker();
            drawHue(pickerEl.querySelector('.ncp-hue-canvas'));
            attachEvents();
        }

        buildPalette();
        setColor(initialColor || '#ffffff');
        activeOnChange = onChange;

        const rect = anchorEl.getBoundingClientRect();
        pickerEl.style.display = 'flex';
        
        const pickerWidth = 260;
        const pickerHeight = 440;
        
        let left = rect.left + (rect.width / 2) - (pickerWidth / 2);
        left = clamp(left, 10, window.innerWidth - pickerWidth - 10);
        
        let top = rect.top - pickerHeight - 15;
        if (top < 10) top = rect.bottom + 15;
        top = clamp(top, 10, window.innerHeight - pickerHeight - 10);

        pickerEl.style.left = left + 'px';
        pickerEl.style.top = top + 'px';
    }

    function close() {
        if (pickerEl) pickerEl.style.display = 'none';
        if (activeOnClose) activeOnClose();
        activeOnChange = null;
        activeOnClose = null;
    }

    // Global closure detection
    window.addEventListener('mousedown', (e) => {
        if (pickerEl && pickerEl.style.display === 'flex') {
            if (!pickerEl.contains(e.target) && !e.target.closest('[data-ignore-close]')) {
                close();
            }
        }
    });

    window.NexusColorPicker = { open, close, saveRecent };
})();
