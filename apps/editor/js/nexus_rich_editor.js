// nexus_rich_editor.js — AAA Rich Dialogue Editor Engine
// Contextual formatting toolbar + controlled contentEditable engine.

(function () {
    'use strict';

    // --- CONSTANTS ---
    const FONTS = [
        { label: 'Outfit (Default)', value: 'Outfit, sans-serif' },
        { label: 'JetBrains Mono',  value: '"JetBrains Mono", monospace' },
        { label: 'Cinzel',          value: '"Cinzel", serif' },
        { label: 'Playfair Display',value: '"Playfair Display", serif' },
        { label: 'Orbitron',        value: '"Orbitron", sans-serif' },
    ];

    // Inject Google Fonts for the new typefaces
    (function injectFonts() {
        const id = 'nexus-re-fonts';
        if (!document.getElementById(id)) {
            const link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Orbitron:wght@400;700&display=swap';
            document.head.appendChild(link);
        }
    })();

    // --- GLOBAL BAR STATE ---
    let barEl = null;
    let activeEditor = null;     // Currently focused NexusRichEditor instance
    let barHideTimer = null;
    let pickerOpen = false;
    let colorMode = null;        // 'text' | 'shadow' | 'outline'

    // --- FORMAT BAR CREATION ---
    function getOrCreateBar() {
        if (barEl) return barEl;

        barEl = document.createElement('div');
        barEl.id = 'nexus-format-bar';
        barEl.className = 'nexus-format-bar';
        barEl.innerHTML = `
            <div class="nfb-group">
                <select class="nfb-font-select" title="Font Family">
                    ${FONTS.map(f => `<option value="${f.value}">${f.label}</option>`).join('')}
                </select>
            </div>
            <div class="nfb-divider"></div>
            <div class="nfb-group">
                <button class="nfb-btn" data-cmd="bold" title="Bold (Ctrl+B)"><b>B</b></button>
                <button class="nfb-btn" data-cmd="italic" title="Italic (Ctrl+I)"><i>I</i></button>
                <button class="nfb-btn" data-cmd="underline" title="Underline (Ctrl+U)"><u>U</u></button>
                <button class="nfb-btn" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>
            </div>
            <div class="nfb-divider"></div>
            <div class="nfb-group">
                <button class="nfb-color-btn" data-mode="text" title="Text Color">
                    <span class="nfb-color-icon">A</span>
                    <span class="nfb-color-bar" id="nfb-text-bar" style="background:#ffffff"></span>
                </button>
                <button class="nfb-color-btn" data-mode="shadow" title="Text Shadow">
                    <span class="nfb-color-icon nfb-shadow-icon">A</span>
                    <span class="nfb-color-bar" id="nfb-shadow-bar" style="background:#000000"></span>
                </button>
                <button class="nfb-color-btn" data-mode="outline" title="Text Outline">
                    <span class="nfb-color-icon nfb-outline-icon">A</span>
                    <span class="nfb-color-bar" id="nfb-outline-bar" style="background:#000000"></span>
                </button>
            </div>
            <div class="nfb-divider"></div>
            <div class="nfb-group nfb-shadow-controls" style="display:none">
                <label class="nfb-mini-label">SHADOW</label>
                <input class="nfb-slider" type="range" min="-10" max="10" value="2" title="Shadow X" data-shadow="x">
                <input class="nfb-slider" type="range" min="-10" max="10" value="2" title="Shadow Y" data-shadow="y">
                <input class="nfb-slider" type="range" min="0" max="20" value="4" title="Shadow Blur" data-shadow="blur">
                <button class="nfb-btn nfb-apply-shadow" title="Apply Shadow">✓</button>
                <button class="nfb-btn nfb-clear-shadow" title="Clear Shadow">✕</button>
            </div>
            <div class="nfb-group nfb-outline-controls" style="display:none">
                <label class="nfb-mini-label">OUTLINE</label>
                <input class="nfb-slider" type="range" min="1" max="8" value="2" title="Outline Width" data-outline="width">
                <button class="nfb-btn nfb-apply-outline" title="Apply Outline">✓</button>
                <button class="nfb-btn nfb-clear-outline" title="Clear Outline">✕</button>
            </div>
            <div class="nfb-divider"></div>
            <div class="nfb-group">
                <div class="nfb-macro-wrap">
                    <button class="nfb-btn nfb-macro-toggle" title="Insert Cinematic Macro">⚡ Macro ▾</button>
                    <div class="nfb-macro-dropdown">
                        ${(window.NEXUS_MACROS || []).map(m => `
                            <div class="nfb-macro-item" data-macro="${m.name}">
                                <span class="nfb-macro-icon">${m.icon}</span>
                                <span class="nfb-macro-name">${m.name}</span>
                                <div class="nfb-macro-intensity">
                                    <button class="nfb-intensity-btn" data-intensity="">⚡</button>
                                    <button class="nfb-intensity-btn" data-intensity="1">①</button>
                                    <button class="nfb-intensity-btn" data-intensity="2">②</button>
                                    <button class="nfb-intensity-btn" data-intensity="3">③</button>
                                </div>
                            </div>
                        `).join('')}
                        <div class="nfb-divider-h"></div>
                        ${(window.NEXUS_TEXT_MACROS || []).map(m => `
                            <div class="nfb-macro-item nfb-text-macro" data-token="${m.token}">
                                <span class="nfb-macro-icon">📝</span>
                                <span class="nfb-macro-name">${m.token}</span>
                                <span class="nfb-macro-desc">${m.desc}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="nfb-divider"></div>
            <button class="nfb-btn nfb-clear-all" title="Clear all formatting from selection">Clear</button>
        `;
        document.body.appendChild(barEl);

        // Shadow sub-controls visibility (exclusive)
        barEl.querySelector('[data-mode="shadow"]').addEventListener('mousedown', e => {
            e.preventDefault();
            const sc = barEl.querySelector('.nfb-shadow-controls');
            const oc = barEl.querySelector('.nfb-outline-controls');
            const isClosing = sc.style.display !== 'none';
            sc.style.display = isClosing ? 'none' : 'flex';
            if (!isClosing) oc.style.display = 'none'; // Close outline if opening shadow
        });
        barEl.querySelector('[data-mode="outline"]').addEventListener('mousedown', e => {
            e.preventDefault();
            const sc = barEl.querySelector('.nfb-shadow-controls');
            const oc = barEl.querySelector('.nfb-outline-controls');
            const isClosing = oc.style.display !== 'none';
            oc.style.display = isClosing ? 'none' : 'flex';
            if (!isClosing) sc.style.display = 'none'; // Close shadow if opening outline
        });

        // Prevent bar clicks from blurring the editor
        barEl.addEventListener('mousedown', e => {
            e.preventDefault();
            clearTimeout(barHideTimer);
        });

        attachBarEvents();
        return barEl;
    }

    function attachBarEvents() {
        // Format buttons (bold/italic etc)
        barEl.querySelectorAll('[data-cmd]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!activeEditor) return;
                document.execCommand(btn.dataset.cmd, false, null);
                activeEditor.syncState();
            });
        });

        // Font selector
        const fontSelect = barEl.querySelector('.nfb-font-select');
        fontSelect.addEventListener('change', () => {
            if (!activeEditor) return;
            activeEditor.applyStyle('fontFamily', fontSelect.value);
        });

        // Color buttons
        barEl.querySelectorAll('.nfb-color-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                if (!activeEditor) return;
                colorMode = btn.dataset.mode;
                let currentColor = '#ffffff';
                if (colorMode === 'shadow') currentColor = activeEditor.shadowColor;
                if (colorMode === 'outline') currentColor = activeEditor.outlineColor;
                pickerOpen = true;
                NexusColorPicker.open(btn, currentColor, (hex) => {
                    if (colorMode === 'text') {
                        document.execCommand('foreColor', false, hex);
                        document.getElementById('nfb-text-bar').style.background = hex;
                    } else if (colorMode === 'shadow') {
                        activeEditor.shadowColor = hex;
                        document.getElementById('nfb-shadow-bar').style.background = hex;
                    } else if (colorMode === 'outline') {
                        activeEditor.outlineColor = hex;
                        document.getElementById('nfb-outline-bar').style.background = hex;
                    }
                }, () => { pickerOpen = false; });
            });
        });

        // Apply Shadow
        barEl.querySelector('.nfb-apply-shadow').addEventListener('click', () => {
            if (!activeEditor) return;
            const x = barEl.querySelector('[data-shadow="x"]').value;
            const y = barEl.querySelector('[data-shadow="y"]').value;
            const blur = barEl.querySelector('[data-shadow="blur"]').value;
            const color = activeEditor.shadowColor || '#000000';
            activeEditor.applyTextShadow(`${x}px ${y}px ${blur}px ${color}`);
        });

        barEl.querySelector('.nfb-clear-shadow').addEventListener('click', () => {
            if (!activeEditor) return;
            activeEditor.applyTextShadow('none');
        });

        // Apply Outline
        barEl.querySelector('.nfb-apply-outline').addEventListener('click', () => {
            if (!activeEditor) return;
            const width = barEl.querySelector('[data-outline="width"]').value;
            const color = activeEditor.outlineColor || '#000000';
            // CSS outline via -webkit-text-stroke
            activeEditor.applyTextStroke(`${width}px ${color}`);
        });

        barEl.querySelector('.nfb-clear-outline').addEventListener('click', () => {
            if (!activeEditor) return;
            activeEditor.applyTextStroke('0px transparent');
        });

        // Macro dropdown toggle
        const macroToggle = barEl.querySelector('.nfb-macro-toggle');
        const macroDd = barEl.querySelector('.nfb-macro-dropdown');
        macroToggle.addEventListener('click', e => {
            e.stopPropagation();
            macroDd.classList.toggle('open');
        });

        // Macro insert buttons
        barEl.querySelectorAll('.nfb-intensity-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                if (!activeEditor) return;
                const item = btn.closest('.nfb-macro-item');
                const name = item.dataset.macro;
                const intensity = btn.dataset.intensity ? parseInt(btn.dataset.intensity) : null;
                activeEditor.insertMacro(name, intensity);
                macroDd.classList.remove('open');
            });
        });

        // Text macro insert
        barEl.querySelectorAll('.nfb-text-macro').forEach(item => {
            item.addEventListener('click', e => {
                e.stopPropagation();
                if (!activeEditor) return;
                document.execCommand('insertText', false, item.dataset.token);
                macroDd.classList.remove('open');
            });
        });

        // Clear formatting
        barEl.querySelector('.nfb-clear-all').addEventListener('click', () => {
            if (!activeEditor) return;
            document.execCommand('removeFormat', false, null);
            activeEditor.syncState();
        });

        // Close macro dropdown on outside click
        window.addEventListener('click', () => macroDd.classList.remove('open'));
    }

    function showBar(editorInstance) {
        clearTimeout(barHideTimer);
        activeEditor = editorInstance;
        const bar = getOrCreateBar();
        const editorEl = editorInstance.editorEl;
        const rect = editorEl.getBoundingClientRect();

        bar.style.display = 'flex';

        // Position below the editor element, adjust if too close to bottom
        let top = rect.bottom + 6;
        if (top + 54 > window.innerHeight) top = rect.top - 60;
        let left = rect.left;
        if (left + 700 > window.innerWidth) left = window.innerWidth - 710;

        bar.style.left = Math.max(6, left) + 'px';
        bar.style.top = Math.max(6, top) + 'px';
        bar.style.opacity = '1';
        bar.style.pointerEvents = 'all';
    }

    function hideBar() {
        if (!barEl || pickerOpen) return;
        barHideTimer = setTimeout(() => {
            if (pickerOpen) return;
            barEl.style.opacity = '0';
            barEl.style.pointerEvents = 'none';
            setTimeout(() => {
                if (barEl && parseFloat(barEl.style.opacity) === 0) {
                    barEl.style.display = 'none';
                }
            }, 220);
            activeEditor = null;
        }, 150);
    }

    // --- RICH EDITOR CLASS ---
    class NexusRichEditor {
        constructor(nodeId, initialHtml, onChange) {
            this.nodeId = nodeId;
            this.onChange = onChange;
            this.shadowColor = '#000000';
            this.outlineColor = '#000000';
            this._savedRange = null;

            this.container = document.createElement('div');
            this.container.className = 'nexus-re-container';

            this.editorEl = document.createElement('div');
            this.editorEl.className = 'nexus-re-editor';
            this.editorEl.contentEditable = 'true';
            this.editorEl.spellcheck = false;
            this.editorEl.autocorrect = 'off';
            this.editorEl.autocapitalize = 'off';
            this.editorEl.dataset.nodeId = nodeId;

            this._setContent(initialHtml || '');

            this.container.appendChild(this.editorEl);
            this._bindEvents();
        }

        _setContent(html) {
            // Convert legacy macro text [shake(2)] to tokens
            const parsed = this._parseLegacyMacros(html);
            this.editorEl.innerHTML = parsed;
        }

        _parseLegacyMacros(html) {
            // Replace [macro] and [macro(n)] patterns with token spans
            return html.replace(/\[([a-zA-Z]+)(?:\((\d)\))?\]/g, (match, name, intensity) => {
                const macro = (window.NEXUS_MACROS || []).find(m => m.name === name);
                if (!macro) return match;
                const icon = macro.icon;
                const label = intensity ? `${icon} ${name}(${intensity})` : `${icon} ${name}`;
                const intAttr = intensity ? `data-intensity="${intensity}"` : '';
                return `<span contenteditable="false" class="nexus-macro-token" data-macro="${name}" ${intAttr} title="${macro.desc}">${label}</span>`;
            });
        }

        _bindEvents() {
            this.editorEl.addEventListener('focus', () => {
                showBar(this);
                this.syncState();
            });

            this.editorEl.addEventListener('mouseup', () => {
                this.syncState();
            });

            this.editorEl.addEventListener('keyup', (e) => {
                // Navigation keys should sync the bar state
                if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
                    this.syncState();
                }
                this._fireChange();
            });

            this.editorEl.addEventListener('blur', () => {
                this._saveSelection();
                if (!pickerOpen) hideBar();
            });

            this.editorEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    // Allow line breaks with Enter; prevent node drag issues
                    e.stopPropagation();
                }
                // Prevent Ctrl+A from selecting whole page
                if (e.ctrlKey && e.key === 'a') {
                    e.stopPropagation();
                }
            });

            // Stop all pointer events from propagating to workspace pan/drag
            this.container.addEventListener('mousedown', e => e.stopPropagation());
            this.container.addEventListener('click', e => e.stopPropagation());

            // Mutation observer to intercept browser-inserted block elements
            const observer = new MutationObserver(() => {
                // Normalize: remove any divs/ps the browser inserted
                this.editorEl.querySelectorAll('div, p, br').forEach(el => {
                    if (el.tagName === 'BR') {
                        // Allow explicit <br> at end for line spacing
                        return;
                    }
                    const frag = document.createDocumentFragment();
                    while (el.firstChild) frag.appendChild(el.firstChild);
                    el.replaceWith(frag);
                });
            });
            observer.observe(this.editorEl, { childList: true, subtree: false });
        }

        _saveSelection() {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                this._savedRange = sel.getRangeAt(0).cloneRange();
            }
        }

        _restoreSelection() {
            if (this._savedRange) {
                try {
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(this._savedRange);
                } catch (e) {
                    console.warn('NexusRichEditor: Selection restoration failed', e);
                }
            }
        }

        _fireChange() {
            if (this.onChange) this.onChange(this.serialize());
        }

        applyStyle(prop, value) {
            try {
                this._restoreSelection();
                this.editorEl.focus();
                if (prop === 'fontFamily') {
                    document.execCommand('fontName', false, value);
                }
                this._fireChange();
                this.syncState();
            } catch (err) {
                console.error('NexusRichEditor: Failed to apply style', err);
            }
        }

        applyTextShadow(shadow) {
            try {
                this._restoreSelection();
                this.editorEl.focus();
                const sel = window.getSelection();
                if (!sel || sel.isCollapsed) return;
                const range = sel.getRangeAt(0);
                
                // Don't surround if range contains macro tokens (they are atomic)
                if (range.cloneContents().querySelector('.nexus-macro-token')) return;

                const span = document.createElement('span');
                span.style.textShadow = shadow;
                range.surroundContents(span);
                this._fireChange();
            } catch (err) {
                console.warn('NexusRichEditor: Could not surround complex selection with shadow', err);
                // Fallback: document.execCommand doesn't support text-shadow, so we just fail gracefully
            }
        }

        applyTextStroke(stroke) {
            try {
                this._restoreSelection();
                this.editorEl.focus();
                const sel = window.getSelection();
                if (!sel || sel.isCollapsed) return;
                const range = sel.getRangeAt(0);

                if (range.cloneContents().querySelector('.nexus-macro-token')) return;

                const span = document.createElement('span');
                span.style.webkitTextStroke = stroke;
                span.style.textStroke = stroke;
                range.surroundContents(span);
                this._fireChange();
            } catch (err) {
                console.warn('NexusRichEditor: Could not surround complex selection with stroke', err);
            }
        }

        insertMacro(name, intensity) {
            this._restoreSelection();
            this.editorEl.focus();
            const token = window.createMacroToken ? createMacroToken(name, intensity) : null;
            if (!token) return;

            const sel = window.getSelection();
            let range;
            if (sel && sel.rangeCount > 0) {
                range = sel.getRangeAt(0);
                range.deleteContents();
            } else {
                range = document.createRange();
                range.selectNodeContents(this.editorEl);
                range.collapse(false);
            }

            // Insert token + zero-width space to allow cursor after it
            const zws = document.createTextNode('\u200B');
            range.insertNode(zws);
            range.insertNode(token);

            // Move cursor after
            const newRange = document.createRange();
            newRange.setStartAfter(zws);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);

            this._fireChange();
        }

        syncState() {
            if (!barEl || !activeEditor) return;
            try {
                // 1. Sync standard command buttons
                ['bold', 'italic', 'underline', 'strikeThrough'].forEach(cmd => {
                    const btn = barEl.querySelector(`[data-cmd="${cmd}"]`);
                    if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
                });

                // 2. Sync font family dropdown
                const fontName = document.queryCommandValue('fontName').replace(/"/g, '');
                const fontSelect = barEl.querySelector('.nfb-font-select');
                if (fontSelect) {
                    // Try to find matching option value
                    const match = Array.from(fontSelect.options).find(opt => opt.value.includes(fontName));
                    if (match) fontSelect.value = match.value;
                }

                // 3. Sync color bars
                const textColor = document.queryCommandValue('foreColor');
                if (textColor) {
                    document.getElementById('nfb-text-bar').style.background = textColor;
                }

                // 4. Sync Shadow/Outline state (advanced)
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                    let parent = sel.getRangeAt(0).commonAncestorContainer;
                    if (parent.nodeType === 3) parent = parent.parentNode;

                    const computed = window.getComputedStyle(parent);
                    
                    const shadow = computed.textShadow;
                    if (shadow && shadow !== 'none') {
                        // Extract color from shadow string (browser format is usually rgb(...) x y blur)
                        const colorMatch = shadow.match(/rgb\(\d+, \d+, \d+\)|#[0-9a-fA-F]+/);
                        if (colorMatch) {
                            document.getElementById('nfb-shadow-bar').style.background = colorMatch[0];
                            activeEditor.shadowColor = colorMatch[0];
                        }
                    }

                    const stroke = computed.webkitTextStrokeColor || computed.textStrokeColor;
                    if (stroke) {
                        document.getElementById('nfb-outline-bar').style.background = stroke;
                        activeEditor.outlineColor = stroke;
                    }
                }
            } catch (err) {
                // Silent fail for sync
            }
        }

        /**
         * Serialize the editor content to { html, plainText }
         * Macro tokens are serialized to their [macro(n)] text form.
         */
        serialize() {
            const clone = this.editorEl.cloneNode(true);

            // Convert macro tokens back to text
            clone.querySelectorAll('.nexus-macro-token').forEach(tok => {
                const name = tok.dataset.macro;
                const intensity = tok.dataset.intensity;
                const text = window.macroToText
                    ? window.macroToText(name, intensity || null)
                    : `[${name}]`;
                tok.replaceWith(document.createTextNode(text));
            });

            // Clean ZWS
            clone.querySelectorAll('*').forEach(el => {
                el.childNodes.forEach(cn => {
                    if (cn.nodeType === 3) cn.textContent = cn.textContent.replace(/\u200B/g, '');
                });
            });

            const html = clone.innerHTML;
            const plainText = clone.textContent;
            return { html, plainText };
        }

        /**
         * Get the DOM container to mount into the node card
         */
        getElement() {
            return this.container;
        }

        destroy() {
            this.container.remove();
        }
    }

    window.NexusRichEditor = NexusRichEditor;
})();
