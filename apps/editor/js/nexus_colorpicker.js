// nexus_colorpicker.js — AAA HSV Color Picker
// Standalone, reusable. No external dependencies.

(function () {
    const RECENT_KEY = 'nexus_recent_colors';
    const MAX_RECENT = 5;

    const PALETTE = [
        '#ffffff', '#c0c0c0', '#808080', '#404040', '#000000',
        '#ff4444', '#ff9d00', '#ffe033', '#44ff66', '#00ffcc',
        '#33aaff', '#8844ff', '#ff44cc', '#ff6633', '#33ffdd',
    ];

    let recentColors = [];
    try { recentColors = JSON.parse(sessionStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { recentColors = []; }

    function saveRecent(hex) {
        hex = hex.toUpperCase();
        recentColors = [hex, ...recentColors.filter(c => c !== hex)].slice(0, MAX_RECENT);
        try { sessionStorage.setItem(RECENT_KEY, JSON.stringify(recentColors)); } catch (e) {}
    }

    // --- HSV <-> RGB conversion ---
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

    // --- Picker state ---
    let pickerEl = null;
    let state = { h: 0, s: 1, v: 1 };
    let activeOnChange = null;
    let activeOnClose = null;
    let svDragging = false;
    let hueDragging = false;

    function buildPicker() {
        const el = document.createElement('div');
        el.id = 'nexus-color-picker';
        el.className = 'nexus-color-picker';
        el.setAttribute('data-ignore-close', 'true');
        el.innerHTML = `
            <div class="ncp-sv-box">
                <canvas class="ncp-sv-canvas" width="180" height="150"></canvas>
                <div class="ncp-sv-cursor"></div>
            </div>
            <div class="ncp-hue-bar">
                <canvas class="ncp-hue-canvas" width="180" height="14"></canvas>
                <div class="ncp-hue-cursor"></div>
            </div>
            <div class="ncp-preview-row">
                <div class="ncp-preview-swatch"></div>
                <div class="ncp-inputs">
                    <input class="ncp-hex-input" type="text" maxlength="7" placeholder="#FFFFFF" spellcheck="false">
                    <div class="ncp-rgb-row">
                        <input class="ncp-r" type="number" min="0" max="255" placeholder="R">
                        <input class="ncp-g" type="number" min="0" max="255" placeholder="G">
                        <input class="ncp-b" type="number" min="0" max="255" placeholder="B">
                    </div>
                </div>
            </div>
            <div class="ncp-section-label">PALETTE</div>
            <div class="ncp-palette"></div>
            <div class="ncp-section-label ncp-recent-label">RECENT</div>
            <div class="ncp-recent"></div>
            <button class="ncp-apply-btn">APPLY</button>
        `;
        document.body.appendChild(el);
        return el;
    }

    function drawSV(canvas, hue) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        const [r, g, b] = hsvToRgb(hue, 1, 1);
        const hueColor = `rgb(${r},${g},${b})`;
        // White → Hue
        const lgH = ctx.createLinearGradient(0, 0, w, 0);
        lgH.addColorStop(0, '#fff');
        lgH.addColorStop(1, hueColor);
        ctx.fillStyle = lgH;
        ctx.fillRect(0, 0, w, h);
        // Top → Black
        const lgV = ctx.createLinearGradient(0, 0, 0, h);
        lgV.addColorStop(0, 'transparent');
        lgV.addColorStop(1, '#000');
        ctx.fillStyle = lgV;
        ctx.fillRect(0, 0, w, h);
    }

    function drawHue(canvas) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        const lg = ctx.createLinearGradient(0, 0, w, 0);
        for (let i = 0; i <= 6; i++) {
            const [r, g, b] = hsvToRgb(i * 60, 1, 1);
            lg.addColorStop(i / 6, `rgb(${r},${g},${b})`);
        }
        ctx.fillStyle = lg;
        ctx.fillRect(0, 0, w, h);
    }

    function updateCursors() {
        const svCanvas = pickerEl.querySelector('.ncp-sv-canvas');
        const svCursor = pickerEl.querySelector('.ncp-sv-cursor');
        svCursor.style.left = (state.s * svCanvas.width) + 'px';
        svCursor.style.top = ((1 - state.v) * svCanvas.height) + 'px';

        const hueCanvas = pickerEl.querySelector('.ncp-hue-canvas');
        const hueCursor = pickerEl.querySelector('.ncp-hue-cursor');
        hueCursor.style.left = ((state.h / 360) * hueCanvas.width) + 'px';
    }

    function updateInputs() {
        const [r, g, b] = hsvToRgb(state.h, state.s, state.v);
        const hex = rgbToHex(r, g, b);
        pickerEl.querySelector('.ncp-hex-input').value = hex;
        pickerEl.querySelector('.ncp-r').value = r;
        pickerEl.querySelector('.ncp-g').value = g;
        pickerEl.querySelector('.ncp-b').value = b;
        pickerEl.querySelector('.ncp-preview-swatch').style.background = hex;
    }

    function notifyChange() {
        const [r, g, b] = hsvToRgb(state.h, state.s, state.v);
        const hex = rgbToHex(r, g, b);
        if (activeOnChange) activeOnChange(hex);
    }

    function setColor(hex) {
        try {
            const [r, g, b] = hexToRgb(hex);
            const [h, s, v] = rgbToHsv(r, g, b);
            state = { h, s, v };
            const svCanvas = pickerEl.querySelector('.ncp-sv-canvas');
            drawSV(svCanvas, state.h);
            updateCursors();
            updateInputs();
        } catch (e) {}
    }

    function buildPalette() {
        const palette = pickerEl.querySelector('.ncp-palette');
        palette.innerHTML = '';
        PALETTE.forEach(hex => {
            const sw = document.createElement('div');
            sw.className = 'ncp-swatch';
            sw.style.background = hex;
            sw.title = hex;
            sw.addEventListener('mousedown', e => { e.preventDefault(); setColor(hex); notifyChange(); });
            palette.appendChild(sw);
        });
    }

    function buildRecent() {
        const recent = pickerEl.querySelector('.ncp-recent');
        recent.innerHTML = '';
        if (recentColors.length === 0) {
            recent.innerHTML = '<span class="ncp-empty">None yet</span>';
            return;
        }
        recentColors.forEach(hex => {
            const sw = document.createElement('div');
            sw.className = 'ncp-swatch';
            sw.style.background = hex;
            sw.title = hex;
            sw.addEventListener('mousedown', e => { e.preventDefault(); setColor(hex); notifyChange(); });
            recent.appendChild(sw);
        });
    }

    function attachEvents() {
        const svCanvas = pickerEl.querySelector('.ncp-sv-canvas');
        const hueCanvas = pickerEl.querySelector('.ncp-hue-canvas');

        function onSVMove(e) {
            const rect = svCanvas.getBoundingClientRect();
            const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
            const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
            state.s = x;
            state.v = 1 - y;
            updateCursors();
            updateInputs();
            notifyChange();
        }

        svCanvas.addEventListener('mousedown', e => {
            svDragging = true;
            onSVMove(e);
            e.preventDefault();
        });

        function onHueMove(e) {
            const rect = hueCanvas.getBoundingClientRect();
            const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
            state.h = x * 360;
            drawSV(svCanvas, state.h);
            updateCursors();
            updateInputs();
            notifyChange();
        }

        hueCanvas.addEventListener('mousedown', e => {
            hueDragging = true;
            onHueMove(e);
            e.preventDefault();
        });

        window.addEventListener('mousemove', e => {
            if (svDragging) onSVMove(e);
            if (hueDragging) onHueMove(e);
        });
        window.addEventListener('mouseup', () => { svDragging = false; hueDragging = false; });

        const hexInput = pickerEl.querySelector('.ncp-hex-input');
        hexInput.addEventListener('input', e => {
            const v = e.target.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(v)) { setColor(v); notifyChange(); }
        });

        ['ncp-r', 'ncp-g', 'ncp-b'].forEach(cls => {
            pickerEl.querySelector('.' + cls).addEventListener('input', () => {
                const r = parseInt(pickerEl.querySelector('.ncp-r').value) || 0;
                const g = parseInt(pickerEl.querySelector('.ncp-g').value) || 0;
                const b = parseInt(pickerEl.querySelector('.ncp-b').value) || 0;
                setColor(rgbToHex(clamp(r,0,255), clamp(g,0,255), clamp(b,0,255)));
                notifyChange();
            });
        });

        pickerEl.querySelector('.ncp-apply-btn').addEventListener('mousedown', e => {
            e.preventDefault();
            const [r, g, b] = hsvToRgb(state.h, state.s, state.v);
            const hex = rgbToHex(r, g, b);
            saveRecent(hex);
            if (activeOnChange) activeOnChange(hex);
            close();
        });

        // Stop picker clicks from bubbling up to window (which would dismiss it)
        pickerEl.addEventListener('mousedown', e => e.stopPropagation());
    }

    function open(anchorEl, initialColor, onChange, onClose) {
        activeOnChange = onChange;
        activeOnClose = onClose;

        if (!pickerEl) {
            pickerEl = buildPicker();
            drawHue(pickerEl.querySelector('.ncp-hue-canvas'));
            buildPalette();
            attachEvents();
        }

        buildRecent();
        setColor(initialColor || '#ffffff');

        // Position near anchor (intelligent above/below placement to avoid blocking the bar)
        const rect = anchorEl.getBoundingClientRect();
        pickerEl.style.display = 'block';
        
        const pickerWidth = 220;
        const pickerHeight = 380;
        
        // Horizontal: try to center under/over the button, but clamp to screen
        let left = rect.left + (rect.width / 2) - (pickerWidth / 2);
        if (left < 10) left = 10;
        if (left + pickerWidth > window.innerWidth - 10) left = window.innerWidth - pickerWidth - 10;
        
        // Vertical: try above first (VN nodes are often at bottom), then below
        let top = rect.top - pickerHeight - 12;
        if (top < 10) {
            // No space above, go below
            top = rect.bottom + 12;
        }
        // Final clamp
        if (top + pickerHeight > window.innerHeight - 10) top = window.innerHeight - pickerHeight - 10;

        pickerEl.style.left = left + 'px';
        pickerEl.style.top = top + 'px';
    }

    function close() {
        if (pickerEl) pickerEl.style.display = 'none';
        if (activeOnClose) activeOnClose();
        activeOnChange = null;
        activeOnClose = null;
    }

    window.NexusColorPicker = { open, close, saveRecent };
})();
