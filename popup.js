document.addEventListener('DOMContentLoaded', () => {
    const rulesBody = document.getElementById('rules-body');
    const addBtn = document.getElementById('add-row');
    const saveBtn = document.getElementById('save-settings');
    const errorMsg = document.getElementById('validation-error');
    const duplicateMsg = document.getElementById('duplicate-msg');
    const importBtn = document.getElementById('import-rules');
    const exportBtn = document.getElementById('export-rules');
    const importInput = document.getElementById('import-file');
    const toolsMenuButton = document.getElementById('tools-menu-button');
    const toolsMenu = document.getElementById('tools-menu');

    const MAX_RULES = 20;
    const DEFAULT_RULE = {
        matchType: 'exact',
        pattern: '',
        color: '#00ff00',
        label: '',
        borderStyle: 'solid',
        borderThickness: 10
    };

    let initialSnapshot = '';

    function normalizeLegacyRule(rule = {}) {
        if (rule.pattern) {
            return {
                matchType: rule.matchType || 'exact',
                pattern: String(rule.pattern),
                color: rule.color || DEFAULT_RULE.color,
                label: rule.label || '',
                borderStyle: rule.borderStyle || 'solid',
                borderThickness: Number(rule.borderThickness) || 10
            };
        }

        if (!rule.url) {
            return { ...DEFAULT_RULE };
        }

        try {
            const parsed = new URL(rule.url);
            const hasPath = parsed.pathname && parsed.pathname !== '/';
            return {
                matchType: hasPath ? 'path' : 'exact',
                pattern: hasPath ? `${parsed.hostname}${parsed.pathname}` : parsed.hostname,
                color: rule.color || DEFAULT_RULE.color,
                label: rule.label || '',
                borderStyle: rule.borderStyle || 'solid',
                borderThickness: Number(rule.borderThickness) || 10
            };
        } catch (e) {
            return {
                ...DEFAULT_RULE,
                pattern: rule.url
            };
        }
    }

    function addRow(rule = DEFAULT_RULE) {
        if (rulesBody.children.length >= MAX_RULES) return;

        const tr = document.createElement('tr');
        tr.className = 'rule-row';
        tr.innerHTML = `
            <td>
                <select class="match-type">
                    <option value="exact">Exact host</option>
                    <option value="wildcard">Wildcard subdomain</option>
                    <option value="path">Host + path</option>
                    <option value="regex">Regex</option>
                </select>
            </td>
            <td>
                <input type="text" class="pattern-input" placeholder="example.com" value="${escapeHtml(rule.pattern || '')}">
                <div class="row-error"></div>
            </td>
            <td><input type="color" class="color-input" value="${rule.color || DEFAULT_RULE.color}"></td>
            <td><input type="text" class="label-input" maxlength="20" placeholder="PROD" value="${escapeHtml(rule.label || '')}"></td>
            <td>
                <select class="style-input">
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="double">Double</option>
                    <option value="dotted">Dotted</option>
                </select>
            </td>
            <td><input type="number" class="thickness-input" min="2" max="40" value="${Number(rule.borderThickness) || 10}"></td>
            <td><button class="btn-delete" type="button" aria-label="Delete rule">×</button></td>
        `;

        tr.querySelector('.match-type').value = rule.matchType || 'exact';
        tr.querySelector('.style-input').value = rule.borderStyle || 'solid';

        tr.querySelector('.btn-delete').onclick = () => {
            tr.remove();
            updateAddButtonState();
            if (rulesBody.children.length === 0) addRow();
            triggerValidation();
        };

        tr.querySelectorAll('input, select').forEach((control) => {
            control.addEventListener('input', triggerValidation);
            control.addEventListener('change', triggerValidation);
        });

        const patternInput = tr.querySelector('.pattern-input');
        tr.querySelector('.match-type').addEventListener('change', (event) => {
            patternInput.placeholder = getPlaceholder(event.target.value);
        });
        patternInput.placeholder = getPlaceholder(tr.querySelector('.match-type').value);

        rulesBody.appendChild(tr);
        updateAddButtonState();
    }

    function updateAddButtonState() {
        addBtn.disabled = rulesBody.children.length >= MAX_RULES;
    }

    function getPlaceholder(matchType) {
        if (matchType === 'wildcard') return '*.example.com or example.com';
        if (matchType === 'path') return 'example.com/admin';
        if (matchType === 'regex') return '^https://(qa|staging)\\.example\\.com(/|$)';
        return 'example.com';
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function canonicalizeRule(rule) {
        const normalized = {
            matchType: rule.matchType,
            pattern: rule.pattern,
            color: (rule.color || DEFAULT_RULE.color).toLowerCase(),
            label: (rule.label || '').trim(),
            borderStyle: rule.borderStyle || 'solid',
            borderThickness: Number(rule.borderThickness)
        };

        if (normalized.matchType === 'regex') {
            normalized.pattern = normalized.pattern.trim();
            return normalized;
        }

        const candidate = normalized.pattern.trim().replace(/^https?:\/\//i, '');
        const withProtocol = `https://${candidate}`;
        const parsed = new URL(withProtocol);
        const host = parsed.hostname.toLowerCase();
        const cleanPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.replace(/\/+$/, '') : '';

        if (normalized.matchType === 'path') {
            normalized.pattern = cleanPath ? `${host}${cleanPath}` : host;
        } else if (normalized.matchType === 'wildcard') {
            normalized.pattern = host.replace(/^\*\./, '');
        } else {
            normalized.pattern = host;
        }

        return normalized;
    }

    function validateRows(showMessages = true) {
        errorMsg.style.display = 'none';
        duplicateMsg.style.display = 'none';

        const rows = Array.from(rulesBody.children);
        const seen = new Map();
        const collected = [];
        let isValid = true;

        rows.forEach((row) => {
            row.querySelector('.pattern-input').classList.remove('error');
            row.querySelector('.row-error').textContent = '';
        });

        for (const row of rows) {
            const matchType = row.querySelector('.match-type').value;
            const patternInput = row.querySelector('.pattern-input');
            const rowError = row.querySelector('.row-error');
            const rawPattern = patternInput.value.trim();
            const rule = {
                matchType,
                pattern: rawPattern,
                color: row.querySelector('.color-input').value,
                label: row.querySelector('.label-input').value.trim(),
                borderStyle: row.querySelector('.style-input').value,
                borderThickness: Number(row.querySelector('.thickness-input').value)
            };

            if (!rawPattern) continue;

            if (!Number.isFinite(rule.borderThickness) || rule.borderThickness < 2 || rule.borderThickness > 40) {
                isValid = false;
                patternInput.classList.add('error');
                rowError.textContent = 'Thickness must be between 2 and 40.';
                continue;
            }

            try {
                if (matchType === 'regex') {
                    new RegExp(rawPattern);
                } else if (matchType === 'path') {
                    const parsed = new URL(`https://${rawPattern.replace(/^https?:\/\//i, '')}`);
                    if (!parsed.hostname) throw new Error('missing hostname');
                } else {
                    const parsed = new URL(`https://${rawPattern.replace(/^https?:\/\//i, '')}`);
                    if (!parsed.hostname) throw new Error('missing hostname');
                }
            } catch (e) {
                isValid = false;
                patternInput.classList.add('error');
                rowError.textContent = matchType === 'regex' ? 'Invalid regular expression.' : 'Invalid host/path pattern.';
                continue;
            }

            const canonical = canonicalizeRule(rule);
            const dedupeKey = `${canonical.matchType}::${canonical.pattern}`;

            if (seen.has(dedupeKey)) {
                isValid = false;
                patternInput.classList.add('error');
                rowError.textContent = 'Duplicate rule.';
                const first = seen.get(dedupeKey);
                first.input.classList.add('error');
                first.error.textContent = 'Duplicate rule.';
                duplicateMsg.style.display = 'block';
                continue;
            }

            seen.set(dedupeKey, { input: patternInput, error: rowError });
            collected.push(canonical);
        }

        if (!isValid && showMessages) {
            errorMsg.style.display = 'block';
        }

        return { isValid, rules: collected };
    }

    function snapshotRules(rules) {
        return JSON.stringify(rules);
    }

    function refreshSaveState() {
        const { isValid, rules } = validateRows(false);
        const hasChanged = snapshotRules(rules) !== initialSnapshot;
        saveBtn.disabled = !isValid || !hasChanged;
    }

    function triggerValidation() {
        refreshSaveState();
    }

    function populateRows(rules) {
        rulesBody.innerHTML = '';
        if (!rules.length) {
            addRow();
            return;
        }
        rules.slice(0, MAX_RULES).forEach((rule) => addRow(normalizeLegacyRule(rule)));
    }

    function saveRules(rules) {
        chrome.storage.local.set({ rules }, () => {
            initialSnapshot = snapshotRules(rules);
            showSuccess();
            refreshSaveState();
        });
    }

    function showSuccess(text = 'Saved!') {
        const originalText = saveBtn.innerText;
        saveBtn.innerText = text;
        saveBtn.style.background = '#10b981';
        setTimeout(() => {
            saveBtn.innerText = originalText;
            saveBtn.style.background = '';
        }, 1400);
    }

    function exportRules() {
        chrome.storage.local.get(['rules'], (result) => {
            const rules = (result.rules || []).map(normalizeLegacyRule);
            const payload = {
                version: 1,
                exportedAt: new Date().toISOString(),
                rules
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `environment-border-rules-${Date.now()}.json`;
            link.click();
            URL.revokeObjectURL(url);
        });
    }

    function importRulesFromFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result || '{}'));
                const imported = Array.isArray(parsed) ? parsed : parsed.rules;
                if (!Array.isArray(imported)) throw new Error('Invalid format');

                const normalized = imported.slice(0, MAX_RULES).map(normalizeLegacyRule);
                populateRows(normalized);
                triggerValidation();
                showSuccess('Imported');
            } catch (e) {
                errorMsg.textContent = 'Import failed. Invalid JSON format.';
                errorMsg.style.display = 'block';
            }
        };
        reader.readAsText(file);
    }

    chrome.storage.local.get(['rules'], (result) => {
        const rules = (result.rules || []).map(normalizeLegacyRule);
        populateRows(rules);
        const initial = validateRows(false).rules;
        initialSnapshot = snapshotRules(initial);
        refreshSaveState();
    });

    addBtn.addEventListener('click', () => {
        addRow();
        triggerValidation();
    });

    saveBtn.addEventListener('click', () => {
        const { isValid, rules } = validateRows(true);
        if (!isValid) return;
        saveRules(rules);
    });

    exportBtn.addEventListener('click', exportRules);

    function setMenuOpen(isOpen) {
        toolsMenu.classList.toggle('open', isOpen);
        toolsMenuButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    toolsMenuButton.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = !toolsMenu.classList.contains('open');
        setMenuOpen(isOpen);
    });

    document.addEventListener('click', (event) => {
        if (!toolsMenu.contains(event.target) && event.target !== toolsMenuButton) {
            setMenuOpen(false);
        }
    });

    toolsMenu.addEventListener('click', () => setMenuOpen(false));
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (event) => {
        importRulesFromFile(event.target.files[0]);
        importInput.value = '';
    });
});
