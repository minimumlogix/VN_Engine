const COLOR_REGEX = /#([A-Fa-f0-9]{3}){1,2}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[0-9.]+\s*)?\)|hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*(?:,\s*[0-9.]+\s*)?\)/gi;
const SYNTAX_REGEX = /(<[^>]+>|(?:\*\*|\*|#+|---|^>))/gm;
let canvasItems = [];
let currentType = null;

const CACHE_KEY = 'nexus_intro_architect_state';

function getThemePrimaryHex() {
    const color = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
    if (!color) return '00f3ff'; // Default fallback

    // If it's already hex
    if (color.startsWith('#')) return color.replace('#', '');

    // If it's rgb(...)
    const rgb = color.match(/\d+/g);
    if (rgb && rgb.length >= 3) {
        return rgb.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
    }

    return '00f3ff';
}

class HistoryManager {
    constructor(maxSize = 50) {
        this.undoStack = [];
        this.redoStack = [];
        this.maxSize = maxSize;
        this.isApplying = false;
    }

    push(state) {
        if (this.isApplying) return;
        const serialized = JSON.stringify(state);
        if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === serialized) return;
        
        this.undoStack.push(serialized);
        if (this.undoStack.length > this.maxSize) this.undoStack.shift();
        this.redoStack = [];
        this.updateButtons();
    }

    undo() {
        if (this.undoStack.length <= 1) return;
        this.isApplying = true;
        const current = this.undoStack.pop();
        this.redoStack.push(current);
        const previous = JSON.parse(this.undoStack[this.undoStack.length - 1]);
        this.applyState(previous);
        this.isApplying = false;
        this.updateButtons();
    }

    redo() {
        if (this.redoStack.length === 0) return;
        this.isApplying = true;
        const next = JSON.parse(this.redoStack.pop());
        this.undoStack.push(JSON.stringify(next));
        this.applyState(next);
        this.isApplying = false;
        this.updateButtons();
    }

    applyState(state) {
        canvasItems = JSON.parse(JSON.stringify(state.canvasItems));
        if (state.theme && document.getElementById('global-theme-select').value !== state.theme) {
            document.getElementById('global-theme-select').value = state.theme;
            updateTheme(true); // Skip history push
        } else {
            renderCanvas();
            updateCodeView();
            saveToCache();
        }
    }

    updateButtons() {
        const undoBtn = document.getElementById('btn-undo');
        const redoBtn = document.getElementById('btn-redo');
        if (undoBtn) undoBtn.disabled = this.undoStack.length <= 1;
        if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
    }
}

const historyManager = new HistoryManager();

function saveToCache() {
    const state = {
        canvasItems,
        theme: document.getElementById('global-theme-select').value
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
}

function recordHistory() {
    const state = {
        canvasItems,
        theme: document.getElementById('global-theme-select').value
    };
    historyManager.push(state);
}

function loadFromCache() {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        try {
            const state = JSON.parse(cached);
            canvasItems = state.canvasItems || [];
            if (state.theme) {
                document.getElementById('global-theme-select').value = state.theme;
                updateTheme();
            }
            renderCanvas();
            updateCodeView();
            saveToCache();
            recordHistory();
            showToast('Previous project restored from cache!');
        } catch (e) {
            console.error('Failed to load cache:', e);
        }
    }
}


window.onload = () => {
    loadFromCache();
    window.addEventListener('keydown', e => {
        if (e.ctrlKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            historyManager.undo();
        } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            historyManager.redo();
        }
    });
};

function updateTheme(skipHistory = false) {
    const theme = document.getElementById('global-theme-select').value;
    const link = document.getElementById('dynamic-theme');

    // Wait for CSS to apply before re-rendering
    link.onload = () => {
        renderCanvas();
        updateCodeView();
        saveToCache(skipHistory);
    };
    link.href = `styles/${theme}`;
}

function switchTab(tab) {
    const live = document.getElementById('canvas-live');
    const code = document.getElementById('canvas-code-container');
    const buttons = document.querySelectorAll('.tab-btn');

    if (tab === 'live') {
        live.style.display = 'flex';
        code.style.display = 'none';
        buttons[0].classList.add('active');
        buttons[1].classList.remove('active');
    } else {
        live.style.display = 'none';
        code.style.display = 'block';
        buttons[0].classList.remove('active');
        buttons[1].classList.add('active');
        updateCodeView();
    }
}

function updateCodeView() {
    const gutter = document.querySelector('.code-gutter');
    const content = document.querySelector('.code-content');
    if (content) {
        const rawHtml = generateFullHTML(false);
        const highlighted = highlightHTML(rawHtml);
        content.innerHTML = highlighted;

        // Update line numbers
        const lineCount = rawHtml.split('\n').length;
        gutter.innerHTML = Array.from({length: lineCount}, (_, i) => i + 1).join('<br>');
    }
}

function highlightHTML(html) {
    // Escape HTML special characters
    let escaped = html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 1. Highlight Comments: <!-- ... -->
    escaped = escaped.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="hl-comm">$1</span>');

    // 2. Highlight Tags and Attributes
    // This regex looks for &lt;tag ... &gt; or &lt;/tag&gt;
    // We use a replacement function to avoid matching our own <span> tags
    return escaped.replace(/(&lt;\/?[a-z1-6]+)(.*?)(&gt;)/gi, (match, tagStart, content, tagEnd) => {
        // Highlight the tag name part
        let highlightedTag = tagStart.replace(/(&lt;\/?)([a-z1-6]+)/i, '$1<span class="hl-tag">$2</span>');

        // Highlight attributes within the tag content
        let highlightedContent = content.replace(/([a-z-]+)=("[^"]*")/gi,
            ' <span class="hl-attr">$1</span>=<span class="hl-str">$2</span>');

        return highlightedTag + highlightedContent + tagEnd;
    });
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'nexus-toast';
    toast.innerText = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

const FORM_TEMPLATES = {
    'image': [
        { label: 'Image URL', id: 'image-url', type: 'text', placeholder: 'https://.../image.png' }
    ],
    'music': [
        { label: 'YouTube URL', id: 'yt-url', type: 'text', placeholder: 'https://www.youtube.com/watch?v=...' }
    ],
    'character': [
        { label: 'Character Name', id: 'char-name', type: 'text', placeholder: 'e.g. Jax' },
        { label: 'Sprite Image URL', id: 'sprite-url', type: 'text', placeholder: 'https://.../character.png' },
        { label: 'Background Image URL', id: 'bg-url', type: 'text', placeholder: 'https://.../bg.png' }
    ],
    'vn-iframe': [
        { label: 'Story ID / URL', id: 'story-id', type: 'text', placeholder: 'Sakuragaoka:VN1' },
        { label: 'Height (px)', id: 'iframe-height', type: 'number', value: 450 }
    ],
    'dialogue': [
        { label: 'Initial Dialogue', id: 'dialogue-text', type: 'textarea', placeholder: 'Enter your dialogue here... (Markdown supported)' }
    ],
    'lore': [
        { label: 'Lore World / Link', id: 'lore-link', type: 'text', placeholder: 'Cyberpunk2011' },
        { label: 'Height (px)', id: 'lore-height', type: 'number', value: 400 }
    ]
};

function openComponentModal(type) {
    currentType = type;
    const fields = FORM_TEMPLATES[type];
    const container = document.getElementById('form-fields');
    const title = document.getElementById('modal-title');
    const addBtn = document.getElementById('add-char-btn');

    title.innerText = `CONFIGURE ${type.replace('-', ' ').toUpperCase()}`;
    container.innerHTML = '';

    if (type === 'character') {
        addBtn.style.display = 'block';
        const bgGroup = createFieldGroup({ label: 'Background Image URL', id: 'bg-url', type: 'text', placeholder: 'https://.../bg.png' });
        container.appendChild(bgGroup);
        addCharacterRow();
    } else {
        addBtn.style.display = 'none';
        fields.forEach(field => {
            const group = createFieldGroup(field);
            container.appendChild(group);

            // Add listeners for rich text
            if (field.type === 'textarea') {
                const textarea = group.querySelector('textarea');
                textarea.addEventListener('mouseup', handleTextSelection);
                textarea.addEventListener('keyup', handleTextSelection);
            }
        });
    }

    document.getElementById('config-modal').style.display = 'flex';
}

function createFieldGroup(field) {
    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.innerText = field.label;

    let input;
    if (field.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 4;
    } else {
        input = document.createElement('input');
        input.type = field.type;
        if (field.value) input.value = field.value;
    }

    input.id = field.id;
    input.placeholder = field.placeholder || '';

    group.appendChild(label);
    group.appendChild(input);
    return group;
}

function addCharacterRow(name = '', sprite = '') {
    const container = document.getElementById('form-fields');
    const row = document.createElement('div');
    row.className = 'char-row';
    row.innerHTML = `
        <button type="button" class="remove-char" onclick="this.parentElement.remove()">×</button>
        <div class="form-group">
            <label>Character Name</label>
            <input type="text" class="char-name" value="${name}" placeholder="e.g. Jax">
        </div>
        <div class="form-group">
            <label>Sprite Image URL</label>
            <input type="text" class="char-sprite" value="${sprite}" placeholder="https://.../sprite.png">
        </div>
    `;
    container.appendChild(row);
}

/* --- RICH TEXT LOGIC --- */
window.lastSavedSelectionRange = null;

function _getEditableFromRange(range) {
    if (!range) return null;
    const container = range.commonAncestorContainer;
    const node = container.nodeType === 3 ? container.parentNode : container;
    return node ? node.closest('[contenteditable="true"]') : null;
}

function _getItemIndexFromEditable(editable) {
    const itemEl = editable ? editable.closest('.canvas-item') : null;
    if (!itemEl) return -1;
    return Array.from(document.querySelectorAll('.canvas-item')).indexOf(itemEl);
}

function _syncRichEditable(editable) {
    const idx = _getItemIndexFromEditable(editable);
    if (idx === -1 || !canvasItems[idx]) return;
    const field = editable.classList.contains('speaker-edit') ? 'speaker-name' : 'dialogue-text';
    canvasItems[idx][field] = field === 'speaker-name'
        ? editable.innerText
        : editable.classList.contains('source-editing')
            ? _getSourceValue(editable)
            : _serializeRichContent(editable);
    updateCodeView();
    saveToCache();
}

function _getSourceValue(el) {
    if (typeof el._sourceValue === 'string') return el._sourceValue;
    return _serializeDecorated(el);
}

function _setSourceValue(el, value, options = {}) {
    el._sourceValue = value;
    _commitSourceValue(el);
    _scanAndDecorateColors(el, {
        force: true,
        preserveCursor: options.preserveCursor !== false
    });
}

function _commitSourceValue(el) {
    const idx = _getItemIndexFromEditable(el);
    if (idx === -1 || !canvasItems[idx]) return;
    canvasItems[idx]['dialogue-text'] = _getSourceValue(el);
    saveToCache();
    updateCodeView();
}

function _closestWithin(node, selector, root) {
    const el = node && (node.nodeType === 3 ? node.parentNode : node);
    if (!el || !el.closest) return null;
    const match = el.closest(selector);
    return match && root.contains(match) ? match : null;
}

function _getActiveStyle(range, editable) {
    const node = range.startContainer;
    const span = _closestWithin(node, 'span[style]', editable);
    return {
        bold: !!_closestWithin(node, 'strong,b', editable),
        italic: !!_closestWithin(node, 'em,i', editable),
        color: span && span.style.color ? span.style.color : '',
        fontFamily: span && span.style.fontFamily ? span.style.fontFamily.replace(/['"]/g, '') : '',
        shadow: !!(span && span.style.textShadow)
    };
}

function handleTextSelection(e) {
    const selection = window.getSelection();

    if (selection.toString().trim().length > 0 && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const editable = _getEditableFromRange(range);
        const textarea = document.querySelector('#form-fields textarea');
        const isTextareaRange = textarea && document.activeElement === textarea;
        if (!editable && !isTextareaRange) return;

        window.lastSavedSelectionRange = range.cloneRange();
        const active = editable ? _getActiveStyle(range, editable) : {};

        document.getElementById('btn-bold').classList.toggle('active', !!active.bold);
        document.getElementById('btn-italic').classList.toggle('active', !!active.italic);
        document.getElementById('btn-shadow').classList.toggle('active', !!active.shadow);
        
        const colorBar = document.querySelector('#btn-color .color-bar');
        if (colorBar) {
            colorBar.style.background = active.color || '#ffffff';
        }
        const fontCurrent = document.querySelector('.font-current');
        if (fontCurrent) {
            const fontName = active.fontFamily || 'Inter';
            fontCurrent.innerHTML = `${fontName} <i class="bi bi-chevron-down" style="font-size: 10px; margin-left: 5px;"></i>`;
        }
        document.getElementById('btn-color').classList.toggle('active', !!active.color);
    }
}

function _unwrapElement(el) {
    const parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
}

function _removeStyleFromFragment(fragment, prop) {
    fragment.querySelectorAll && fragment.querySelectorAll('[style]').forEach(el => {
        el.style[prop] = '';
        if (!el.getAttribute('style')) _unwrapElement(el);
    });
}

function _selectNodeContents(node) {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(node);
    sel.removeAllRanges();
    sel.addRange(range);
    window.lastSavedSelectionRange = range.cloneRange();
}

function _serializeNodeText(node) {
    let text = "";
    const walk = (current) => {
        if (current.nodeType === 3) {
            text += current.textContent;
            return;
        }
        if (current.nodeType !== 1 && current.nodeType !== 11) return;
        if (current.tagName === 'BR') {
            text += "\n";
            return;
        }
        if (current.classList && current.classList.contains('nexus-color-decorator')) {
            text += current.dataset.color || current.innerText || '';
            return;
        }
        if (current.classList && current.classList.contains('nexus-ghost-syntax')) {
            text += current.innerText || current.textContent || '';
            return;
        }
        for (let child of current.childNodes) walk(child);
    };
    walk(node);
    return text;
}

function _getSourceRange(editable, range) {
    const preRange = range.cloneRange();
    preRange.selectNodeContents(editable);
    preRange.setEnd(range.startContainer, range.startOffset);

    const selected = range.cloneContents();
    const start = _serializeNodeText(preRange.cloneContents()).length;
    const selectedText = _serializeNodeText(selected);
    return {
        start,
        end: start + selectedText.length,
        text: selectedText
    };
}

function _replaceSourceRange(editable, range, replacement) {
    const sourceRange = _getSourceRange(editable, range);
    const source = _getSourceValue(editable);
    editable._sourceValue = source.slice(0, sourceRange.start) + replacement + source.slice(sourceRange.end);
    _commitSourceValue(editable);
    _scanAndDecorateColors(editable, { force: true, preserveCursor: false });
    return { ...sourceRange, replacement };
}

function _applySourceFormat(editable, range, type, value) {
    if (!editable) return;
    const isImage = type === 'image';
    if (range.collapsed && !isImage) return;
    
    const sourceRange = _getSourceRange(editable, range);
    if (!sourceRange.text && !isImage) return;

    let replacement = sourceRange.text || '';
    const source = _getSourceValue(editable);
    
    // Improved detection: check if text is ALREADY wrapped in the source
    const before = source.slice(0, sourceRange.start);
    const after = source.slice(sourceRange.end);

    const isBold = (t) => t.startsWith('**') && t.endsWith('**');
    const isItalic = (t) => t.startsWith('*') && !t.startsWith('**') && t.endsWith('*') && !t.endsWith('**');
    
    if (type === 'bold') {
        if (isBold(sourceRange.text)) replacement = sourceRange.text.slice(2, -2);
        else if (before.endsWith('**') && after.startsWith('**')) {
            // Selection is inside bold, we need to split it
            // For simplicity, let's just use the standard wrapping if not perfectly aligned
            replacement = `**${sourceRange.text}**`;
        } else replacement = `**${sourceRange.text}**`;
    } else if (type === 'italic') {
        if (isItalic(sourceRange.text)) replacement = sourceRange.text.slice(1, -1);
        else replacement = `*${sourceRange.text}*`;
    } else if (type === 'color') {
        // Remove existing spans of same type if they exist exactly around selection
        const spanRegex = /<span style="color:[^"]+">(.*?)<\/span>/;
        if (spanRegex.test(sourceRange.text)) {
            replacement = sourceRange.text.replace(spanRegex, '$1');
        }
        replacement = `<span style="color:${value}">${replacement}</span>`;
    } else if (type === 'gradient') {
        // Replace existing style/gradient
        replacement = `<span style="${value}">${sourceRange.text.replace(/<span style="[^"]+">(.*?)<\/span>/g, '$1')}</span>`;
    } else if (type === 'font') {
        replacement = `<span style="font-family: '${value}'">${sourceRange.text}</span>`;
    } else if (type === 'image') {
        replacement = `![image](${value})`;
    } else if (type === 'shadow') {
        replacement = `<span style="text-shadow: 2px 2px 4px rgba(0,0,0,0.5)">${sourceRange.text}</span>`;
    } else if (type === 'effect') {
        const dataAttr = value === 'effect-glitch' ? ` data-text="${sourceRange.text}"` : '';
        replacement = `<span class="${value}"${dataAttr}>${sourceRange.text}</span>`;
    }

    _replaceSourceRange(editable, range, replacement);
}

function _wrapRange(range, tagName, options = {}) {
    const wrapper = document.createElement(tagName);
    if (options.style) Object.assign(wrapper.style, options.style);

    const fragment = range.extractContents();
    if (options.clearStyle) _removeStyleFromFragment(fragment, options.clearStyle);
    wrapper.appendChild(fragment);
    range.insertNode(wrapper);
    wrapper.normalize();
    _selectNodeContents(wrapper);
    return wrapper;
}

function _applyInlineDomFormat(editable, range, type, value) {
    if (!editable || range.collapsed) return;
    if (editable.classList.contains('source-editing')) {
        _applySourceFormat(editable, range, type, value);
        return;
    }

    const activeNode = range.startContainer;
    const tagSelector = type === 'bold' ? 'strong,b' : type === 'italic' ? 'em,i' : null;

    if (tagSelector) {
        const activeWrapper = _closestWithin(activeNode, tagSelector, editable);
        if (activeWrapper && activeWrapper.contains(range.endContainer)) {
            _unwrapElement(activeWrapper);
            _syncRichEditable(editable);
            handleTextSelection();
            return;
        }

        _wrapRange(range, type === 'bold' ? 'strong' : 'em');
        _syncRichEditable(editable);
        handleTextSelection();
        return;
    }

    if (type === 'color' || type === 'shadow' || type === 'gradient') {
        const prop = type === 'color' ? 'color' : type === 'shadow' ? 'textShadow' : 'style';
        const existingSpan = _closestWithin(activeNode, 'span[style]', editable);

        if (existingSpan && existingSpan.contains(range.endContainer)) {
            if (type === 'color') existingSpan.style.color = value;
            else if (type === 'shadow') existingSpan.style.textShadow = existingSpan.style.textShadow ? '' : '2px 2px 4px rgba(0,0,0,0.5)';
            else if (type === 'gradient') {
                // Apply gradient style string
                existingSpan.setAttribute('style', value);
            }

            if (!existingSpan.getAttribute('style')) _unwrapElement(existingSpan);
            _selectNodeContents(existingSpan.parentNode && existingSpan.isConnected ? existingSpan : editable);
            _syncRichEditable(editable);
            handleTextSelection();
            return;
        }

        if (type === 'gradient') {
            _wrapRange(range, 'span', { style: {}, clearStyle: null }).setAttribute('style', value);
        } else {
            const style = type === 'color'
                ? { color: value }
                : { textShadow: '2px 2px 4px rgba(0,0,0,0.5)' };
            _wrapRange(range, 'span', { style, clearStyle: prop });
        }
        _syncRichEditable(editable);
        handleTextSelection();
        return;
    }

    if (type === 'effect') {
        const existingSpan = _closestWithin(activeNode, 'span[class*="effect-"]', editable);
        
        if (existingSpan && existingSpan.contains(range.endContainer)) {
            if (existingSpan.classList.contains(value)) {
                existingSpan.classList.remove(value);
                if (value === 'effect-glitch') existingSpan.removeAttribute('data-text');
                // If no more effect classes, unwrap
                const hasEffects = Array.from(existingSpan.classList).some(cls => cls.startsWith('effect-'));
                if (!hasEffects) _unwrapElement(existingSpan);
            } else {
                existingSpan.classList.add(value);
                if (value === 'effect-glitch') existingSpan.setAttribute('data-text', existingSpan.innerText);
            }
            _syncRichEditable(editable);
            handleTextSelection();
            return;
        }
        
        const textContent = range.toString();
        const wrapper = _wrapRange(range, 'span', {});
        wrapper.className = value;
        if (value === 'effect-glitch') {
            wrapper.setAttribute('data-text', textContent);
        }
        _syncRichEditable(editable);
        handleTextSelection();
    }
}

function applyFormat(type, value) {
    let sel = window.getSelection();
    let range;

    if (sel.rangeCount > 0) {
        const container = sel.getRangeAt(0).commonAncestorContainer;
        const isEditable = (container.nodeType === 3 ? container.parentNode : container).closest('[contenteditable="true"], textarea');
        if (isEditable) {
            range = sel.getRangeAt(0);
        }
    }

    if (!range && window.lastSavedSelectionRange) {
        sel.removeAllRanges();
        sel.addRange(window.lastSavedSelectionRange);
        range = window.lastSavedSelectionRange;
    }

    if (!range) return;

    const editable = _getEditableFromRange(range);
    const textarea = document.querySelector('#form-fields textarea');

    if (type === 'effect' && value === 'effect-gradient-loop' && editable) {
        const btn = document.getElementById('btn-gradient');
        window.NexusColorPicker.open(btn, '#00f3ff', (c1) => {
            setTimeout(() => {
                window.NexusColorPicker.open(btn, '#ff00ff', (c2) => {
                    _applyInlineDomFormat(editable, range, 'effect', value);
                    // Find the newly created/updated span and set variables
                    const activeNode = range.startContainer;
                    const span = _closestWithin(activeNode, '.effect-gradient-loop', editable);
                    if (span) {
                        span.style.setProperty('--grad-c1', c1);
                        span.style.setProperty('--grad-c2', c2);
                        _syncRichEditable(editable);
                    }
                });
            }, 300);
        });
        return;
    }

    if (editable) {
        if (editable.classList.contains('source-editing')) {
            _applySourceFormat(editable, range, type, value);
        } else {
            _applyInlineDomFormat(editable, range, type, value);
        }
    } else if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        let newText = selectedText;

        switch(type) {
            case 'bold':
                if (selectedText.startsWith('**') && selectedText.endsWith('**')) {
                    newText = selectedText.slice(2, -2);
                } else {
                    newText = `**${selectedText}**`;
                }
                break;
            case 'italic':
                // Check for ** first to avoid misidentifying bold as italic
                if (selectedText.startsWith('***') && selectedText.endsWith('***')) {
                    newText = `**${selectedText.slice(3, -3)}**`;
                } else if (selectedText.startsWith('*') && !selectedText.startsWith('**') && selectedText.endsWith('*') && !selectedText.endsWith('**')) {
                    newText = selectedText.slice(1, -1);
                } else {
                    newText = `*${selectedText}*`;
                }
                break;
            case 'color': newText = `<span style="color:${value}">${selectedText}</span>`; break;
            case 'gradient': newText = `<span style="${value}">${selectedText}</span>`; break;
            case 'shadow': newText = `<span style="text-shadow: 2px 2px 4px rgba(0,0,0,0.5)">${selectedText}</span>`; break;
            case 'effect': 
                const dataAttr = value === 'effect-glitch' ? ` data-text="${selectedText}"` : '';
                newText = `<span class="${value}"${dataAttr}>${selectedText}</span>`; 
                break;
            case 'image':
                newText = `![image](${value})`;
                break;
        }

        textarea.value = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
        textarea.focus();
        textarea.setSelectionRange(start, start + newText.length);
    }
}

const PREMIUM_GRADIENTS = [
    { name: 'Cyberpunk', c1: '#00f3ff', c2: '#ff00ff', angle: 90 },
    { name: 'Sunset', c1: '#ff5f6d', c2: '#ffc371', angle: 45 },
    { name: 'Emerald', c1: '#11998e', c2: '#38ef7d', angle: 135 },
    { name: 'Royal', c1: '#141e30', c2: '#243b55', angle: 180 },
    { name: 'Golden', c1: '#f2994a', c2: '#f2c94c', angle: 90 },
    { name: 'Frost', c1: '#00c6ff', c2: '#0072ff', angle: 45 },
    { name: 'Midnight', c1: '#232526', c2: '#414345', angle: 90 },
    { name: 'Lush', c1: '#56ab2f', c2: '#a8e063', angle: 45 },
    { name: 'Plasma', c1: '#eb3349', c2: '#f45c43', angle: 135 },
    { name: 'Aura', c1: '#614385', c2: '#516395', angle: 90 }
];

let activeGradEditable = null;
let activeGradRange = null;

function openGradientDesigner() {
    const sel = window.getSelection();
    let range = null;
    if (sel.rangeCount > 0) range = sel.getRangeAt(0);
    if (!range && window.lastSavedSelectionRange) range = window.lastSavedSelectionRange;
    
    if (!range || range.collapsed) {
        showToast('Please select some text first!');
        return;
    }

    const editable = _getEditableFromRange(range);
    if (!editable) return;

    activeGradEditable = editable;
    activeGradRange = range.cloneRange();
    
    // Set preview text to current selection
    const previewText = document.getElementById('gradient-preview-text');
    if (previewText) {
        previewText.innerText = range.toString().trim() || 'PREVIEW TEXT';
    }
    
    editable._toolLock = true;
    editable._gradientModalOpen = true;

    // Hide toolbar to prevent layering issues
    const toolbar = document.getElementById('rich-text-toolbar');
    if (toolbar) toolbar.style.display = 'none';

    // Initialize palettes
    const paletteGrid = document.getElementById('gradient-palettes');
    paletteGrid.innerHTML = '';
    PREMIUM_GRADIENTS.forEach(p => {
        const sw = document.createElement('div');
        sw.className = 'palette-swatch';
        sw.style.background = `linear-gradient(${p.angle}deg, ${p.c1}, ${p.c2})`;
        sw.title = p.name;
        sw.onclick = () => {
            gradState = { ...p };
            updateGradDesignerUI();
            updateGradPreview();
        };
        paletteGrid.appendChild(sw);
    });

    document.getElementById('gradient-modal').style.display = 'flex';
    updateGradDesignerUI();
    updateGradPreview();
}

function updateGradDesignerUI() {
    document.getElementById('grad-stop-1').style.background = gradState.c1;
    document.getElementById('grad-stop-2').style.background = gradState.c2;
    document.getElementById('grad-hex-1').value = gradState.c1.toUpperCase();
    document.getElementById('grad-hex-2').value = gradState.c2.toUpperCase();
    document.getElementById('grad-angle').value = gradState.angle;
    document.getElementById('angle-val').innerText = gradState.angle;
}

function pickGradColor(stop) {
    const btn = document.getElementById(`grad-stop-${stop}`);
    const initial = stop === 1 ? gradState.c1 : gradState.c2;
    window.NexusColorPicker.open(btn, initial, (color) => {
        if (stop === 1) gradState.c1 = color;
        else gradState.c2 = color;
        updateGradDesignerUI();
        updateGradPreview();
    });
}

function updateGradPreview() {
    gradState.angle = document.getElementById('grad-angle').value;
    document.getElementById('angle-val').innerText = gradState.angle;
    
    const gradStr = `linear-gradient(${gradState.angle}deg, ${gradState.c1}, ${gradState.c2})`;
    const preview = document.getElementById('gradient-preview-text');
    preview.style.background = gradStr;
    preview.style.webkitBackgroundClip = 'text';
    preview.style.backgroundClip = 'text';
    preview.style.webkitTextFillColor = 'transparent';

    // Live preview in editor - only if we have a valid selection
    if (activeGradEditable && activeGradRange) {
        const style = `background: ${gradStr}; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; display: inline-block;`;
        
        // Temporarily restore range to apply format
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(activeGradRange);
        
        applyFormat('gradient', style);
        
        // Update stored range after modification
        const newSel = window.getSelection();
        if (newSel.rangeCount > 0) activeGradRange = newSel.getRangeAt(0).cloneRange();
    }
}

function saveGradient() {
    closeGradientModal();
    if (activeGradEditable) {
        activeGradEditable.focus();
    }
    recordHistory();
    showToast('Gradient applied!');
}

function closeGradientModal() {
    const modal = document.getElementById('gradient-modal');
    modal.style.display = 'none';
    
    // Unlock active editable
    if (activeGradEditable) {
        activeGradEditable._toolLock = false;
        activeGradEditable._gradientModalOpen = false;
        _maybeFinishSourceEdit(activeGradEditable);
    }
    activeGradEditable = null;
    activeGradRange = null;
}

function applyFont(fontName) {
    applyFormat('font', fontName);
    
    // Update toolbar display
    const currentFont = document.querySelector('.font-current');
    if (currentFont) {
        currentFont.innerHTML = `${fontName} <i class="bi bi-chevron-down" style="font-size: 10px; margin-left: 5px;"></i>`;
        currentFont.parentElement.classList.remove('active');
    }
}

function insertImage() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    
    const sel = window.getSelection();
    let range = null;
    if (sel.rangeCount > 0) range = sel.getRangeAt(0);
    if (!range && window.lastSavedSelectionRange) range = window.lastSavedSelectionRange;
    
    const editable = range ? _getEditableFromRange(range) : null;
    if (editable) editable._toolLock = true;

    overlay.innerHTML = `
        <div class="modal-content" style="width: min(100%, 500px);">
            <div class="modal-header">
                <h2>INSERT IMAGE</h2>
                <p>Enter the URL for the image asset.</p>
            </div>
            <div class="form-group">
                <label>Image URL</label>
                <input type="text" id="insert-image-url" value="https://via.placeholder.com/400x200.png?text=Dialogue+Asset">
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button id="confirm-image-btn" class="btn-success" style="flex: 1;">INSERT</button>
                <button id="cancel-image-btn" class="btn-outline" style="flex: 1;">CANCEL</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    const input = document.getElementById('insert-image-url');
    input.focus();
    input.select();
    
    const cleanup = () => {
        if (editable) {
            editable._toolLock = false;
            if (editable.isConnected && editable.classList.contains('source-editing')) {
                editable.focus();
            }
        }
        overlay.remove();
    };

    document.getElementById('confirm-image-btn').onclick = () => {
        const url = input.value.trim();
        if (url) {
            applyFormat('image', url);
        }
        cleanup();
    };

    document.getElementById('cancel-image-btn').onclick = cleanup;
}

function clearFormatting() {
    const sel = window.getSelection();
    let range = null;
    if (sel.rangeCount > 0) range = sel.getRangeAt(0);
    if (!range && window.lastSavedSelectionRange) range = window.lastSavedSelectionRange;
    if (!range || range.collapsed) return;

    const editable = _getEditableFromRange(range);
    if (!editable) return;

    if (editable.classList.contains('source-editing')) {
        const sourceRange = _getSourceRange(editable, range);
        if (!sourceRange.text) return;
        
        // Strip all HTML tags from the source text
        const cleaned = sourceRange.text.replace(/<[^>]*>/g, '');
        _replaceSourceRange(editable, range, cleaned);
        showToast('Formatting cleared!');
    } else {
        document.execCommand('removeFormat');
        _syncRichEditable(editable);
    }
}

function applyGradient() {
    openGradientDesigner();
}

function openToolbarColorPicker(button) {
    const sel = window.getSelection();
    let range = null;
    if (sel.rangeCount > 0) range = sel.getRangeAt(0);
    if (!range && window.lastSavedSelectionRange) range = window.lastSavedSelectionRange;
    if (!range || range.collapsed) return;

    const editable = _getEditableFromRange(range);
    const initial = button.dataset.color || '#ffffff';
    const colorBar = button.querySelector('.color-bar');

    if (editable && editable.classList.contains('source-editing')) {
        const sourceRange = _getSourceRange(editable, range);
        if (!sourceRange.text) return;
        let activeStart = sourceRange.start;
        let activeEnd = sourceRange.end;
        const selectedSource = sourceRange.text;

        editable._toolLock = true;
        editable._colorPickerOpen = true;
        window.NexusColorPicker.open(button, initial, (color) => {
            const replacement = `<span style="color:${color}">${selectedSource}</span>`;
            const source = _getSourceValue(editable);
            editable._sourceValue = source.slice(0, activeStart) + replacement + source.slice(activeEnd);
            activeEnd = activeStart + replacement.length;
            button.dataset.color = color;
            if (colorBar) colorBar.style.background = color;
            _commitSourceValue(editable);
            _scanAndDecorateColors(editable, { force: true, preserveCursor: false });
        }, () => {
            editable._toolLock = false;
            editable._colorPickerOpen = false;
            editable._pendingPickerBlur = false;
            if (editable.isConnected && editable.classList.contains('source-editing')) {
                editable.focus({ preventScroll: true });
                _scanAndDecorateColors(editable, { force: true, preserveCursor: false });
            }
        });
        return;
    }

    window.NexusColorPicker.open(button, initial, (color) => {
        applyFormat('color', color);
        button.dataset.color = color;
        if (colorBar) colorBar.style.background = color;
    });
}

function syncInlineChange(index, newContent) {
    // If it's a dialogue, we store the content
    // We try to keep it as raw as possible
    canvasItems[index]['dialogue-text'] = newContent;
    updateCodeView();
    saveToCache();
}

function parseMarkdown(text) {
    if (!text) return '';

    // 1. Protect existing HTML tags
    const placeholders = [];
    let html = text.replace(/<[^>]+>/g, (match) => {
        const id = `__PH_${placeholders.length}__`;
        placeholders.push(match);
        return id;
    });

    // 2. Line-by-line Processing for Block Elements
    let lines = html.split(/\r?\n/);
    let processedLines = lines.map(line => {
        let trimmed = line.trim();

        // Headings
        if (trimmed.startsWith('#')) {
            const hMatch = trimmed.match(/^(#+) (.*)$/);
            if (hMatch) {
                const level = Math.min(hMatch[1].length, 6);
                return `<h${level} style="margin: 0.5rem 0;">${hMatch[2]}</h${level}>`;
            }
        }

        // Horizontal Rule
        if (trimmed === '---') {
            return '<hr style="border:none;height:1px;background:linear-gradient(90deg,transparent,var(--accent),transparent);margin:20px 0;opacity:0.3">';
        }

        // Lists
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            return `<li style="margin-left:20px;list-style-type:square;color:var(--accent);margin-bottom:4px;"><span style="color:white">${trimmed.substring(2)}</span></li>`;
        }

        // Blockquotes
        if (trimmed.startsWith('> ')) {
            return `<blockquote style="border-left:3px solid var(--accent);padding-left:15px;margin:10px 0;font-style:italic;opacity:0.8">${trimmed.substring(2)}</blockquote>`;
        }

        // Inline transformations
        let content = line
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<div class="vn-image-wrapper"><img src="$2" alt="$1"></div>')
            .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:var(--accent);text-decoration:none;border-bottom:1px dashed var(--accent)">$1</a>');

        return content + (line === '' ? '<br>' : '');
    });

    // Join with <br> but skip for lines that already produced block elements
    html = "";
    for (let i = 0; i < processedLines.length; i++) {
        const line = processedLines[i];
        const isBlock = line.startsWith('<h') || line.startsWith('<hr') || line.startsWith('<li') || line.startsWith('<blockquote') || line.startsWith('<div');
        html += line;
        if (!isBlock && i < processedLines.length - 1) {
            html += '<br>';
        }
    }

    // 3. Restore HTML tags
    placeholders.forEach((tag, i) => {
        html = html.replace(`__PH_${i}__`, tag);
    });

    return html;
}

function _saveCursor(el) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);

    // Check if the cursor is actually inside our element
    if (!el.contains(range.startContainer)) return null;

    const preRange = range.cloneRange();
    preRange.selectNodeContents(el);
    preRange.setEnd(range.startContainer, range.startOffset);
    return _serializeNodeText(preRange.cloneContents()).length;
}

function _restoreCursor(el, offset) {
    if (offset === null || offset === undefined) return;
    if (document.activeElement !== el) return;

    const sel = window.getSelection();
    const range = document.createRange();
    let charCount = 0;
    let restored = false;
    const totalLen = _getSourceValue(el).length;
    if (offset > totalLen) offset = totalLen;

    const visit = (node) => {
        if (restored) return;
        if (node.nodeType === 3) {
            const nextCharCount = charCount + node.textContent.length;
            if (offset >= charCount && offset <= nextCharCount) {
                range.setStart(node, offset - charCount);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                restored = true;
                return;
            }
            charCount = nextCharCount;
            return;
        }

        if (node.nodeType !== 1) return;

        if (node.tagName === 'BR') {
            if (charCount === offset) {
                range.setStartBefore(node);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                restored = true;
                return;
            }
            charCount += 1;
            return;
        }

        if (node.classList && (node.classList.contains('nexus-color-decorator') || node.classList.contains('nexus-ghost-syntax'))) {
            const token = _serializeNodeText(node);
            const nextCharCount = charCount + token.length;
            if (offset <= nextCharCount) {
                if (offset - charCount > token.length / 2) {
                    range.setStartAfter(node);
                } else {
                    range.setStartBefore(node);
                }
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                restored = true;
                return;
            }
            charCount = nextCharCount;
            return;
        }

        for (let child of node.childNodes) visit(child);
    };

    for (let child of el.childNodes) visit(child);

    if (!restored) {
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

function _createColorDecorator(token, el, sourceStart, sourceEnd) {
    const decorator = document.createElement('span');
    decorator.className = 'nexus-color-decorator';
    decorator.contentEditable = 'false';
    decorator.dataset.color = token;
    decorator.dataset.sourceStart = sourceStart;
    decorator.dataset.sourceEnd = sourceEnd;
    decorator.innerHTML = `<span class="nexus-color-swatch" style="background:${token}"></span><span class="nexus-color-text">${token}</span>`;

    decorator.querySelector('.nexus-color-swatch').addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();
        const swatchEl = decorator.querySelector('.nexus-color-swatch');
        el._colorPickerOpen = true;
        el._toolLock = true;
        let activeSourceStart = sourceStart;
        let activeSourceEnd = sourceEnd;
        window.NexusColorPicker.open(swatchEl, token, (newHex) => {
            const currentSource = _getSourceValue(el);
            el._sourceValue = currentSource.slice(0, activeSourceStart) + newHex + currentSource.slice(activeSourceEnd);
            activeSourceEnd = activeSourceStart + newHex.length;
            _commitSourceValue(el);
            _scanAndDecorateColors(el, { force: true, preserveCursor: false });
        }, () => {
            el._colorPickerOpen = false;
            el._pendingPickerBlur = false;
            el._toolLock = false;
            if (el.isConnected && el.classList.contains('source-editing')) {
                el.focus({ preventScroll: true });
                _scanAndDecorateColors(el, { force: true, preserveCursor: false });
            }
        });
    });
    return decorator;
}

function _scanAndDecorateColors(el, options = {}) {
    // 1. Fast Guard: Don't do anything if we don't have focus or text is unchanged
    if (!options.force && document.activeElement !== el) return;
    if (el._isComposing) return;
    const fullText = _getSourceValue(el);
    if (el._lastDecoratedText === fullText) return;
    el._lastDecoratedText = fullText;

    // 2. Capture precise cursor position JUST before we destroy the DOM
    const cursorOffset = options.preserveCursor === false ? null : _saveCursor(el);
    const frag = document.createDocumentFragment();

    // Combined regex for colors and syntax
    // We use a manual loop to find the nearest match among multiple regexes
    let lastIdx = 0;
    const combinedRegex = new RegExp(`(${COLOR_REGEX.source})|(${SYNTAX_REGEX.source})`, 'gi');
    let match;

    while (match = combinedRegex.exec(fullText)) {
        // Text before the match
        frag.appendChild(document.createTextNode(fullText.substring(lastIdx, match.index)));

        const token = match[0];

        // Is it a color?
        const isColor = new RegExp(`^(${COLOR_REGEX.source})$`, 'i').test(token);

        if (isColor) {
            frag.appendChild(_createColorDecorator(token, el, match.index, combinedRegex.lastIndex));
        } else {
            // It's syntax (Markdown or HTML)
            // Check if this syntax token (like an HTML tag) contains a color inside it
            COLOR_REGEX.lastIndex = 0;
            if (COLOR_REGEX.test(token)) {
                let subIdx = 0;
                let subMatch;
                COLOR_REGEX.lastIndex = 0;
                while (subMatch = COLOR_REGEX.exec(token)) {
                    // Ghost text before sub-color
                    if (subMatch.index > subIdx) {
                        const ghost = document.createElement('span');
                        ghost.className = 'nexus-ghost-syntax';
                        ghost.innerText = token.substring(subIdx, subMatch.index);
                        frag.appendChild(ghost);
                    }

                    // The color itself
                    frag.appendChild(_createColorDecorator(subMatch[0], el, match.index + subMatch.index, match.index + COLOR_REGEX.lastIndex));
                    subIdx = COLOR_REGEX.lastIndex;
                }
                // Trailing ghost text
                if (subIdx < token.length) {
                    const ghost = document.createElement('span');
                    ghost.className = 'nexus-ghost-syntax';
                    ghost.innerText = token.substring(subIdx);
                    frag.appendChild(ghost);
                }
            } else {
                const ghost = document.createElement('span');
                ghost.className = 'nexus-ghost-syntax';
                ghost.innerText = token;
                frag.appendChild(ghost);
            }
        }

        lastIdx = combinedRegex.lastIndex;
    }

    frag.appendChild(document.createTextNode(fullText.substring(lastIdx)));

    el.innerHTML = '';
    el.appendChild(frag);

    if (document.activeElement === el) {
        _restoreCursor(el, cursorOffset);
    }
}

function _serializeDecorated(el) {
    // Advanced manual walker to preserve formatting from contenteditable
    let text = "";
    const walk = (node) => {
        if (node.nodeType === 3) {
            text += node.textContent;
        } else if (node.tagName === 'BR') {
            text += "\n";
        } else if (node.classList && node.classList.contains('nexus-color-decorator')) {
            text += node.dataset.color;
        } else if (node.classList && node.classList.contains('nexus-ghost-syntax')) {
            text += node.innerText;
        } else {
            const isBlock = ['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(node.tagName);
            const needsLeadingNewline = isBlock && text.length > 0 && !text.endsWith('\n');
            if (needsLeadingNewline) text += "\n";

            for (let child of node.childNodes) {
                walk(child);
            }

            if (isBlock && !text.endsWith('\n')) text += "\n";
        }
    };
    walk(el);
    return text.trim();
}

function _escapeAttr(value) {
    return String(value).replace(/"/g, '&quot;');
}

function _serializeRichContent(el) {
    const serialize = (node) => {
        if (node.nodeType === 3) return node.textContent;
        if (node.nodeType !== 1) return '';

        const tag = node.tagName;
        if (tag === 'BR') return '\n';
        if (node.classList.contains('nexus-color-decorator')) return node.dataset.color || '';
        if (node.classList.contains('nexus-ghost-syntax')) return node.innerText || '';

        const inner = Array.from(node.childNodes).map(serialize).join('');

        if (tag === 'STRONG' || tag === 'B') return `**${inner}**`;
        if (tag === 'EM' || tag === 'I') return `*${inner}*`;
        if (tag === 'IMG') {
            const src = node.getAttribute('src') || '';
            const alt = node.getAttribute('alt') || '';
            return `![${alt}](${src})`;
        }
        if (tag === 'A') {
            const href = node.getAttribute('href') || '';
            return href ? `[${inner}](${href})` : inner;
        }
        if (/^H[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag[1]))} ${inner}\n`;
        if (tag === 'LI') return `- ${inner}\n`;
        if (tag === 'BLOCKQUOTE') return `> ${inner}\n`;
        if (tag === 'HR') return '---\n';

        if (tag === 'SPAN') {
            const style = node.getAttribute('style');
            const classes = Array.from(node.classList).join(' ');
            const dataText = node.getAttribute('data-text') ? ` data-text="${_escapeAttr(node.getAttribute('data-text'))}"` : '';
            
            let attrs = '';
            if (style) attrs += ` style="${_escapeAttr(style)}"`;
            if (classes) attrs += ` class="${classes}"`;
            if (dataText) attrs += dataText;
            
            return attrs ? `<span${attrs}>${inner}</span>` : inner;
        }

        if (['DIV', 'P'].includes(tag)) {
            return `${inner}${inner.endsWith('\n') ? '' : '\n'}`;
        }

        return inner;
    };

    return Array.from(el.childNodes).map(serialize).join('').trim();
}

function _finishSourceEdit(el) {
    const idx = _getItemIndexFromEditable(el);
    if (idx === -1 || !canvasItems[idx]) return;

    canvasItems[idx]['dialogue-text'] = _getSourceValue(el);
    el.innerHTML = parseMarkdown(canvasItems[idx]['dialogue-text']);
    el.classList.remove('editing-mode', 'source-editing');
    el._sourceValue = null;
    el._lastDecoratedText = null;
    el._toolLock = false;
    el._colorPickerOpen = false;
    el._pendingPickerBlur = false;
    saveToCache();
    updateCodeView();
    recordHistory();
}

function _maybeFinishSourceEdit(el) {
    if (el._toolLock || el._colorPickerOpen || el._gradientModalOpen) {
        el._pendingPickerBlur = true;
        return;
    }
    // Use a small timeout to allow activeElement to stabilize
    setTimeout(() => {
        if (!el.isConnected || !el.classList.contains('source-editing')) return;
        if (el._toolLock || el._colorPickerOpen || el._gradientModalOpen) {
            el._pendingPickerBlur = true;
            return;
        }
        
        const active = document.activeElement;
        const toolbar = document.getElementById('rich-text-toolbar');
        const picker = document.getElementById('nexus-color-picker');
        const gradModal = document.getElementById('gradient-modal');
        
        // Robust check for focus targets
        const isFocusOnToolbar = toolbar && (toolbar === active || toolbar.contains(active));
        const isFocusOnPicker = picker && (picker === active || picker.contains(active) || active.closest('.nexus-color-picker'));
        const isFocusOnGradModal = gradModal && (gradModal === active || gradModal.contains(active));
        const isFocusOnSwatch = active && active.classList.contains('nexus-color-swatch');

        if (active === el) return;
        if (isFocusOnToolbar || isFocusOnPicker || isFocusOnGradModal || isFocusOnSwatch || (active && active.closest('.modal-overlay'))) return;
        
        // If we reach here, we are truly blurring away from editing
        if (toolbar && toolbar.parentElement !== document.body) {
            toolbar.style.display = 'none';
            document.body.appendChild(toolbar);
        }
        _finishSourceEdit(el);
    }, 100);
}

function closeModal() {
    document.getElementById('config-modal').style.display = 'none';
}

function extractYoutubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length == 11) ? match[2] : null;
}

function saveComponent() {
    const itemData = { type: currentType, id: Date.now() };

    if (currentType === 'character') {
        itemData['bg-url'] = document.getElementById('bg-url').value;
        itemData.characters = [];
        const rows = document.querySelectorAll('.char-row');
        rows.forEach(row => {
            itemData.characters.push({
                name: row.querySelector('.char-name').value,
                sprite: row.querySelector('.char-sprite').value
            });
        });
    } else {
        const fields = FORM_TEMPLATES[currentType];
        fields.forEach(field => {
            itemData[field.id] = document.getElementById(field.id).value;
        });
    }

    if (currentType === 'music') {
        const ytId = extractYoutubeId(itemData['yt-url']);
        if (!ytId) {
            alert('Invalid YouTube URL');
            return;
        }
        itemData.ytId = ytId;
    }

    canvasItems.push(itemData);
    renderCanvas();
    updateCodeView();
    saveToCache();
    recordHistory();
    closeModal();
}

function renderCanvas() {
    const canvas = document.getElementById('canvas-live');
    const emptyState = document.getElementById('empty-state');

    // Clear current canvas (except empty state)
    const items = canvas.querySelectorAll('.canvas-item');
    const toolbar = document.getElementById('rich-text-toolbar');
    if (toolbar && toolbar.parentElement !== document.body) {
        toolbar.style.display = 'none';
        document.body.appendChild(toolbar);
    }
    items.forEach(i => i.remove());

    if (canvasItems.length > 0) {
        emptyState.style.display = 'none';
    } else {
        emptyState.style.display = 'block';
    }

    canvasItems.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = 'canvas-item';
        
        let editBtn = '';
        if (item.type === 'music') {
            editBtn = `<button class="control-btn edit" onclick="editMusicLink(${index})"><i class="bi bi-pencil"></i></button>`;
        } else if (item.type === 'image') {
            editBtn = `<button class="control-btn edit" onclick="editImageLink(${index})"><i class="bi bi-pencil"></i></button>`;
        }

        el.innerHTML = `<div class="item-label">${item.type.replace('-', ' ')}</div><div class="item-controls">${editBtn}<button class="control-btn" onclick="moveItem(${index}, -1)"><i class="bi bi-chevron-up"></i></button><button class="control-btn" onclick="moveItem(${index}, 1)"><i class="bi bi-chevron-down"></i></button><button class="control-btn delete" onclick="removeItem(${index})"><i class="bi bi-trash"></i></button></div><div class="item-preview">${getPreviewHTML(item)}</div>`;

        // Enable inline editing for dialogue
        if (item.type === 'dialogue') {
            const content = el.querySelector('.vn-dialogue-content');
            if (content) {
                content.contentEditable = true;
                content.classList.add('inline-edit');

                content.addEventListener('focus', (e) => {
                    const toolbar = document.getElementById('rich-text-toolbar');
                    const itemEl = e.target.closest('.canvas-item');
                    itemEl.insertBefore(toolbar, itemEl.firstChild);
                    toolbar.style.display = 'flex';

                    // Record history before edit
                    recordHistory();

                    e.target._sourceValue = item['dialogue-text'] || '';
                    e.target.innerText = e.target._sourceValue;
                    e.target.classList.add('editing-mode', 'source-editing');
                    e.target._lastDecoratedText = null;
                    e.target._toolLock = false;
                    e.target._colorPickerOpen = false;
                    e.target._pendingPickerBlur = false;
                    e.target._isComposing = false;
                    requestAnimationFrame(() => _scanAndDecorateColors(e.target, { force: true }));
                });

                content.addEventListener('blur', (e) => {
                    _maybeFinishSourceEdit(e.target);
                });

                content.addEventListener('mouseup', handleTextSelection);
                content.addEventListener('keyup', handleTextSelection);
                content.addEventListener('selectionchange', handleTextSelection);
                content.addEventListener('compositionstart', (e) => {
                    e.target._isComposing = true;
                    clearTimeout(content._decorateTimer);
                });
                content.addEventListener('compositionend', (e) => {
                    e.target._isComposing = false;
                    e.target._sourceValue = _serializeDecorated(e.target);
                    _commitSourceValue(e.target);
                });

                // Sync for main content
                content.addEventListener('input', (e) => {
                    e.target._sourceValue = _serializeDecorated(e.target);
                    _commitSourceValue(e.target);

                    clearTimeout(content._decorateTimer);
                    content._decorateTimer = setTimeout(() => {
                        if (e.target._isComposing) return;
                        if (document.activeElement !== e.target) return;
                        const sel = window.getSelection();
                        if (!sel || sel.rangeCount === 0 || !sel.getRangeAt(0).collapsed) return;
                        requestAnimationFrame(() => {
                            if (!e.target._isComposing && document.activeElement === e.target) {
                                _scanAndDecorateColors(e.target, { force: true });
                            }
                        });
                    }, 1000);
                });

            }
        }

        canvas.appendChild(el);
    });
}

function getPreviewHTML(item) {
    const themeColor = getThemePrimaryHex();

    switch(item.type) {
        case 'image':
            return `<div class="vn-image-wrapper"><img src="${item['image-url']}"></div>`;
        case 'music':
            return `<iframe allow="autoplay; encrypted-media" src="https://minimumlogix.github.io/VN_Engine/apps/music/mw?v=${item.ytId}&c=${themeColor}&vol=100&autoplay=1" style="width:100%;height:75px;border:none"></iframe>`;
        case 'character':
            let charHtml = `<div class="vn-character-container" style="background-image:url(${item['bg-url']})">`;
            (item.characters || []).forEach(char => {
                charHtml += `
                    <div class="vn-character-group">
                        <div class="vn-character-name">${char.name}</div>
                        <img alt="${char.name}" class="speaking vn-character" src="${char.sprite}">
                    </div>`;
            });
            charHtml += `</div>`;
            return charHtml;
        case 'vn-iframe':
            return `<iframe allow="autoplay; encrypted-media" src="https://minimumlogix.github.io/VN_Engine?story=${item['story-id']}" style="width:100%;height:${item['iframe-height']}px;border:none"></iframe>`;
        case 'dialogue':
            return `<div class="vn-dialogue-box"><div class="vn-dialogue-content" style="color: #fff !important;">${parseMarkdown(item['dialogue-text'])}</div></div>`;
        case 'lore':
            return `
                <details class="vn-lore-details" open>
                    <summary class="vn-lore-summary">
                        <span>Lore Database</span>
                        <svg class="vn-lore-icon" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" /></svg>
                    </summary>
                    <div class="vn-lore-content">
                        <iframe allow="autoplay; encrypted-media" src="https://minimumlogix.github.io/VN_Engine/apps/lore?world=${item['lore-link']}" style="width:100%;height:${item['lore-height']}px;border:none;border-radius: 5px;"></iframe>
                    </div>
                </details>`;
        default:
            return '';
    }
}

function editMusicLink(index) {
    const item = canvasItems[index];
    const currentUrl = item['yt-url'] || `https://www.youtube.com/watch?v=${item.ytId}`;
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    
    overlay.innerHTML = `
        <div class="modal-content" style="width: 500px;">
            <div class="modal-header">
                <h2>UPDATE MUSIC LINK</h2>
                <p>Enter the new YouTube URL for this track.</p>
            </div>
            <div class="form-group">
                <label>YouTube URL</label>
                <input type="text" id="edit-music-url" value="${currentUrl}" style="width: 100%; box-sizing: border-box;">
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button id="save-music-btn" class="btn-success" style="flex: 1;">SAVE</button>
                <button class="btn-outline" style="flex: 1;" onclick="this.closest('.modal-overlay').remove()">CANCEL</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Focus the input
    const input = document.getElementById('edit-music-url');
    input.focus();
    input.select();
    
    document.getElementById('save-music-btn').addEventListener('click', () => {
        const newUrl = input.value;
        const trimmedUrl = newUrl.trim();
        
        if (trimmedUrl === '') {
            showToast('Operation cancelled (Empty URL)');
            overlay.remove();
            return;
        }

        const ytId = extractYoutubeId(trimmedUrl);
        if (ytId) {
            canvasItems[index].ytId = ytId;
            canvasItems[index]['yt-url'] = trimmedUrl;
            renderCanvas();
            updateCodeView();
            saveToCache();
            showToast('Music updated successfully!');
            overlay.remove();
        } else {
            alert('Could not detect a valid YouTube ID from that link. Please check the URL format.');
        }
    });
}

function editImageLink(index) {
    const item = canvasItems[index];
    const currentUrl = item['image-url'] || '';
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    
    overlay.innerHTML = `
        <div class="modal-content" style="width: min(100%, 500px);">
            <div class="modal-header">
                <h2>UPDATE IMAGE LINK</h2>
                <p>Enter the new URL for this full-width image.</p>
            </div>
            <div class="form-group">
                <label>Image URL</label>
                <input type="text" id="edit-image-url" value="${currentUrl}">
            </div>
            <div style="display: flex; gap: var(--space-md); margin-top: var(--space-xl);">
                <button id="save-image-btn" class="btn-success" style="flex: 1;">SAVE</button>
                <button class="btn-outline" style="flex: 1;" onclick="this.closest('.modal-overlay').remove()">CANCEL</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Focus the input
    const input = document.getElementById('edit-image-url');
    input.focus();
    input.select();
    
    document.getElementById('save-image-btn').addEventListener('click', () => {
        const newUrl = input.value.trim();
        
        if (newUrl === '') {
            showToast('Operation cancelled (Empty URL)');
            overlay.remove();
            return;
        }

        canvasItems[index]['image-url'] = newUrl;
        renderCanvas();
        updateCodeView();
        saveToCache();
        showToast('Image updated successfully!');
        overlay.remove();
    });
}

function removeItem(index) {
    canvasItems.splice(index, 1);
    renderCanvas();
    updateCodeView();
    saveToCache();
    recordHistory();
}

function moveItem(index, direction) {
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < canvasItems.length) {
        const temp = canvasItems[index];
        canvasItems[index] = canvasItems[newIndex];
        canvasItems[newIndex] = temp;
        renderCanvas();
        updateCodeView();
        saveToCache();
        recordHistory();
    }
}

function clearCanvas() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML = `
        <div class="modal-content" style="width: 400px; text-align: center;">
            <div class="modal-header">
                <h2 style="color: #ff4757;">CLEAR CANVAS?</h2>
                <p>This will remove all elements from your current project.</p>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button class="btn-primary" style="flex: 1; background: #ff4757; color: white;" onclick="this.closest('.modal-overlay').remove(); canvasItems = []; renderCanvas(); updateCodeView(); saveToCache(); showToast('Canvas cleared.');">CLEAR ALL</button>
                <button class="btn-outline" style="flex: 1;" onclick="this.closest('.modal-overlay').remove()">CANCEL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function clearCache() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML = `
        <div class="modal-content" style="width: 400px; text-align: center;">
            <div class="modal-header">
                <h2 style="color: #ff4757;">PURGE CACHE?</h2>
                <p>This will delete the project from your browser storage.</p>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button class="btn-primary" style="flex: 1; background: #ff4757; color: white;" onclick="this.closest('.modal-overlay').remove(); localStorage.removeItem('${CACHE_KEY}'); canvasItems = []; renderCanvas(); updateCodeView(); showToast('Cache purged.');">PURGE DATA</button>
                <button class="btn-outline" style="flex: 1;" onclick="this.closest('.modal-overlay').remove()">CANCEL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function generateFullHTML(minified) {
    const theme = document.getElementById('global-theme-select').value;
    const themeColor = getThemePrimaryHex();
    const indent = minified ? '' : '    ';
    const newline = minified ? '' : '\n';

    let html = '';
    html += `<link href="https://minimumlogix.github.io/VN_Engine/apps/single_vn/styles/${theme}" rel="stylesheet">${newline}${newline}`;

    canvasItems.forEach(item => {
        switch(item.type) {
            case 'image':
                html += `<div class="vn-image-wrapper">${newline}`;
                html += `${indent}<img src="${item['image-url']}">${newline}`;
                html += `</div>${newline}`;
                break;
            case 'music':
                html += `<iframe allow="autoplay; encrypted-media" src="https://minimumlogix.github.io/VN_Engine/apps/music/mw?v=${item.ytId}&c=${themeColor}&vol=100&autoplay=1" style="width:100%;height:75px;border:none"></iframe>${newline}`;
                break;
            case 'character':
                html += `<div class="vn-character-container" style="background-image:url(${item['bg-url']})">${newline}`;
                (item.characters || []).forEach(char => {
                    html += `${indent}<div class="vn-character-group">${newline}`;
                    html += `${indent}${indent}<div class="vn-character-name">${char.name}</div>${newline}`;
                    html += `${indent}${indent}<img alt="${char.name}" class="speaking vn-character" src="${char.sprite}">${newline}`;
                    html += `${indent}</div>${newline}`;
                });
                html += `</div>${newline}`;
                break;
            case 'vn-iframe':
                html += `<iframe allow="autoplay; encrypted-media" src="https://minimumlogix.github.io/VN_Engine?story=${item['story-id']}" style="width:100%;height:${item['iframe-height']}px;border:none"></iframe>${newline}`;
                break;
            case 'dialogue':
                const dialogueText = (item['dialogue-text'] || '').replace(/\r\n/g, '\n');
                const parsedContent = parseMarkdown(dialogueText);
                if (minified) {
                    html += `<div class="vn-dialogue-box"><div class="vn-dialogue-content">\n\n${parsedContent}\n</div></div>${newline}`;
                } else {
                    html += `<div class="vn-dialogue-box">${newline}`;
                    html += `${indent}<div class="vn-dialogue-content">${newline}${newline}`;
                    html += `${parsedContent}${newline}`;
                    html += `${indent}</div>${newline}`;
                    html += `</div>${newline}`;
                }
                break;
            case 'lore':
                html += `<details class="vn-lore-details">${newline}`;
                html += `${indent}<summary class="vn-lore-summary">${newline}`;
                html += `${indent}${indent}<span>Lore Database</span>${newline}`;
                html += `${indent}${indent}<svg class="vn-lore-icon" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" /></svg>${newline}`;
                html += `${indent}</summary>${newline}`;
                html += `${indent}<div class="vn-lore-content">${newline}`;
                html += `${indent}${indent}<iframe allow="autoplay; encrypted-media" src="https://minimumlogix.github.io/VN_Engine/apps/lore?world=${item['lore-link']}" style="width:100%;height:${item['lore-height']}px;border:none;border-radius: 5px;"></iframe>${newline}`;
                html += `${indent}</div>${newline}`;
                html += `</details>${newline}`;
                break;
        }
    });

    if (minified) {
        return html.trim();
    }
    return html;
}


function copyMinifiedCode() {
    const code = generateFullHTML(true);

    // Modern approach
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(() => {
            showToast('Minified code copied to clipboard!');
        }).catch(err => {
            console.error('Clipboard error:', err);
            fallbackCopyTextToClipboard(code);
        });
    } else {
        fallbackCopyTextToClipboard(code);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast('Minified code copied (fallback)!');
        } else {
            showToast('Unable to copy code.');
        }
    } catch (err) {
        showToast('Fallback: Oops, unable to copy');
    }

    document.body.removeChild(textArea);
}



// Global Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && (e.key === 'b' || e.key === 'i')) {
        const type = e.key === 'b' ? 'bold' : 'italic';
        const selection = window.getSelection();

        // Check if we are in an editable context
        const textarea = document.querySelector('#form-fields textarea');
        const isTextareaActive = textarea && document.activeElement === textarea;

        let isEditable = false;
        if (selection.rangeCount > 0) {
            const container = selection.getRangeAt(0).commonAncestorContainer;
            isEditable = (container.nodeType === 3 ? container.parentNode : container).closest('[contenteditable="true"]');
        }

        if (isEditable || isTextareaActive) {
            e.preventDefault();
            applyFormat(type);

            // Visual feedback via toast for shortcut usage
            if (!isTextareaActive) {
                handleTextSelection();
            }
        }
    }
});
