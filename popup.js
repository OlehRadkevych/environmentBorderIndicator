document.addEventListener('DOMContentLoaded', () => {
    const rulesBody = document.getElementById('rules-body');
    const addBtn = document.getElementById('add-row');
    const saveBtn = document.getElementById('save-settings');
    const errorMsg = document.getElementById('validation-error');
    const duplicateMsg = document.getElementById('duplicate-msg');
    const importBtn = document.getElementById('import-rules');
    const exportBtn = document.getElementById('export-rules');
    const importInput = document.getElementById('import-file');
    const tableContainer = document.querySelector('.table-container');
    const toolsMenuButton = document.getElementById('tools-menu-button');
    const toolsMenu = document.getElementById('tools-menu');
    const matchedByInfo = document.getElementById('matched-by-info');
    const isPausedToggle = document.getElementById('is-paused-toggle');
    const pauseToggleLabel = document.getElementById('pause-toggle-label');

    const MAX_RULES = 20;
    const DEFAULT_RULE = {
        matchType: 'exact',
        pattern: '',
        color: '#00ff00',
        label: '',
        enabled: true,
        borderStyle: 'solid',
        borderThickness: 10,
        priority: 0
    };

    let initialSnapshot = '';
    let initialPaused = false;
    let dragState = { row: null };
    let currentTabUrl = '';

    function normalizeLegacyRule(rule = {}, index = 0) {
        const rawPriority = Number(rule.priority);
        const fallbackPriority = index + 1;
        const priority = Number.isFinite(rawPriority) ? rawPriority : fallbackPriority;

        if (rule.pattern) {
            return {
                matchType: rule.matchType || 'exact',
                pattern: String(rule.pattern),
                color: rule.color || DEFAULT_RULE.color,
                label: rule.label || '',
                enabled: rule.enabled !== false,
                borderStyle: rule.borderStyle || 'solid',
                borderThickness: Number(rule.borderThickness) || 10,
                priority
            };
        }

        if (!rule.url) {
            return { ...DEFAULT_RULE, priority };
        }

        try {
            const parsed = new URL(rule.url);
            const hasPath = parsed.pathname && parsed.pathname !== '/';
            return {
                matchType: hasPath ? 'path' : 'exact',
                pattern: hasPath ? `${parsed.hostname}${parsed.pathname}` : parsed.hostname,
                color: rule.color || DEFAULT_RULE.color,
                label: rule.label || '',
                enabled: rule.enabled !== false,
                borderStyle: rule.borderStyle || 'solid',
                borderThickness: Number(rule.borderThickness) || 10,
                priority
            };
        } catch (e) {
            return {
                ...DEFAULT_RULE,
                pattern: rule.url,
                priority
            };
        }
    }

    function addRow(rule = DEFAULT_RULE) {
        if (rulesBody.children.length >= MAX_RULES) return;

        const tr = document.createElement('tr');
        tr.className = 'rule-row';
        tr.innerHTML = `
            <td class="drag-cell">
                <button class="drag-handle" type="button" title="Drag to reorder" aria-label="Drag to reorder">↕</button>
                <span class="priority-value"></span>
            </td>
            <td class="enabled-cell"><input type="checkbox" class="enabled-input" ${rule.enabled === false ? '' : 'checked'}></td>
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
            <td>
                <input type="text" class="label-input" maxlength="20" placeholder="PROD" value="${escapeHtml(rule.label || '')}">
                <input type="hidden" class="style-input" value="${escapeHtml(rule.borderStyle || 'solid')}">
                <input type="hidden" class="thickness-input" value="${Number(rule.borderThickness) || 10}">
            </td>
            <td><button class="btn-delete" type="button" aria-label="Delete rule">×</button></td>
        `;

        tr.querySelector('.match-type').value = rule.matchType || 'exact';
        setupDragAndDrop(tr);

        tr.querySelector('.btn-delete').onclick = () => {
            tr.remove();
            if (rulesBody.children.length === 0) addRow();
            updateRowPriorities();
            updateAddButtonState();
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
        updateRowPriorities();
        updateAddButtonState();
    }

    function updateAddButtonState() {
        addBtn.disabled = rulesBody.children.length >= MAX_RULES;
    }

    function updateRowPriorities() {
        Array.from(rulesBody.children).forEach((row, index) => {
            const priority = index + 1;
            row.dataset.priority = String(priority);
            row.querySelector('.priority-value').textContent = `P${priority}`;
        });
    }

    function setupDragAndDrop(row) {
        const handle = row.querySelector('.drag-handle');
        row.draggable = true;

        handle.addEventListener('mousedown', () => {
            row.classList.add('drag-intent');
        });
        handle.addEventListener('mouseup', () => {
            row.classList.remove('drag-intent');
        });

        row.addEventListener('dragstart', (event) => {
            if (!row.classList.contains('drag-intent')) {
                event.preventDefault();
                return;
            }

            dragState.row = row;
            row.classList.add('dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', 'rule-row');
        });

        row.addEventListener('dragend', () => {
            row.classList.remove('dragging');
            row.classList.remove('drag-intent');
            dragState.row = null;
            Array.from(rulesBody.children).forEach((item) => item.classList.remove('drag-over'));
        });

        row.addEventListener('dragover', (event) => {
            if (!dragState.row || dragState.row === row) return;
            event.preventDefault();
            row.classList.add('drag-over');
            const midpoint = row.getBoundingClientRect().top + row.offsetHeight / 2;
            if (event.clientY < midpoint) {
                rulesBody.insertBefore(dragState.row, row);
            } else {
                rulesBody.insertBefore(dragState.row, row.nextSibling);
            }
            updateRowPriorities();
        });

        row.addEventListener('dragleave', () => {
            row.classList.remove('drag-over');
        });

        row.addEventListener('drop', (event) => {
            event.preventDefault();
            row.classList.remove('drag-over');
            updateRowPriorities();
            triggerValidation();
        });
    }

    function scrollRulesToBottom() {
        if (!tableContainer) return;
        tableContainer.scrollTo({
            top: tableContainer.scrollHeight,
            behavior: 'smooth'
        });
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
            enabled: rule.enabled !== false,
            borderStyle: rule.borderStyle || 'solid',
            borderThickness: Number(rule.borderThickness),
            priority: Number(rule.priority)
        };

        if (!Number.isFinite(normalized.priority)) {
            normalized.priority = Number.MAX_SAFE_INTEGER;
        }

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

        updateRowPriorities();

        const rows = Array.from(rulesBody.children);
        const seen = new Map();
        const collected = [];
        let isValid = true;

        rows.forEach((row) => {
            row.querySelector('.pattern-input').classList.remove('error');
            row.querySelector('.row-error').textContent = '';
        });

        for (const [index, row] of rows.entries()) {
            const matchType = row.querySelector('.match-type').value;
            const patternInput = row.querySelector('.pattern-input');
            const rowError = row.querySelector('.row-error');
            const rawPattern = patternInput.value.trim();
            const rule = {
                matchType,
                pattern: rawPattern,
                color: row.querySelector('.color-input').value,
                label: row.querySelector('.label-input').value.trim(),
                enabled: row.querySelector('.enabled-input').checked,
                borderStyle: row.querySelector('.style-input').value,
                borderThickness: Number(row.querySelector('.thickness-input').value),
                priority: Number(row.dataset.priority)
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
            collected.push({ ...canonical, _index: index });
        }

        if (!isValid && showMessages) {
            errorMsg.style.display = 'block';
        }

        const sortedRules = collected
            .sort((a, b) => a.priority - b.priority || a._index - b._index)
            .map(({ _index, ...rule }) => rule);

        return { isValid, rules: sortedRules };
    }

    function snapshotRules(rules) {
        return JSON.stringify(rules);
    }

    function refreshPauseToggleAppearance() {
        if (!pauseToggleLabel || !isPausedToggle) return;
        pauseToggleLabel.classList.toggle('is-paused', isPausedToggle.checked);
    }

    function ensureLeadingSlash(pathname) {
        if (!pathname) return '/';
        return pathname.startsWith('/') ? pathname : `/${pathname}`;
    }

    function hostMatchesWildcard(host, patternHost) {
        const cleanPattern = patternHost.toLowerCase().replace(/^\*\./, '');
        return host === cleanPattern || host.endsWith(`.${cleanPattern}`);
    }

    function ruleMatchesUrl(rule, currentUrlObj) {
        const currentHost = currentUrlObj.hostname.toLowerCase();

        if (rule.matchType === 'regex') {
            try {
                const regex = new RegExp(rule.pattern);
                return regex.test(currentUrlObj.href);
            } catch (e) {
                return false;
            }
        }

        const safePattern = String(rule.pattern || '').trim().replace(/^https?:\/\//i, '');
        const parsed = new URL(`https://${safePattern}`);
        const ruleHost = parsed.hostname.toLowerCase();

        if (rule.matchType === 'wildcard') {
            return hostMatchesWildcard(currentHost, ruleHost);
        }

        if (rule.matchType === 'path') {
            if (ruleHost !== currentHost) return false;
            const pathPrefix = ensureLeadingSlash(parsed.pathname).replace(/\/+$/, '');
            const currentPath = ensureLeadingSlash(currentUrlObj.pathname);
            return pathPrefix === '' || pathPrefix === '/' || currentPath.startsWith(pathPrefix);
        }

        return ruleHost === currentHost;
    }

    function refreshMatchedByPreview() {
        if (!matchedByInfo) return;
        if (!currentTabUrl) {
            matchedByInfo.textContent = 'Current tab URL is not available. Grant tabs permission or open popup on a web page.';
            return;
        }

        let parsedUrl;
        try {
            parsedUrl = new URL(currentTabUrl);
        } catch (e) {
            matchedByInfo.textContent = 'Current tab URL cannot be parsed.';
            return;
        }

        const { rules } = validateRows(false);
        if (isPausedToggle?.checked) {
            matchedByInfo.textContent = 'Indicator is paused globally. Rules are kept but not applied.';
            return;
        }

        const match = rules.find((rule) => {
            try {
                if (!rule.enabled) return false;
                return ruleMatchesUrl(rule, parsedUrl);
            } catch (e) {
                return false;
            }
        });

        if (!match) {
            matchedByInfo.textContent = `No match for ${parsedUrl.href}`;
            return;
        }

        matchedByInfo.textContent = `P${match.priority} · ${match.matchType} · ${match.pattern}${match.label ? ` · label: ${match.label}` : ''}`;
    }

    function refreshSaveState() {
        const { isValid, rules } = validateRows(false);
        const hasChanged = snapshotRules(rules) !== initialSnapshot || Boolean(isPausedToggle?.checked) !== initialPaused;
        saveBtn.disabled = !isValid || !hasChanged;
        refreshPauseToggleAppearance();
        refreshMatchedByPreview();
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
        rules.slice(0, MAX_RULES).forEach((rule, index) => addRow(normalizeLegacyRule(rule, index)));
    }

    function saveRules(rules) {
        const isPaused = Boolean(isPausedToggle?.checked);
        chrome.storage.local.set({ rules, isPaused }, () => {
            initialSnapshot = snapshotRules(rules);
            initialPaused = isPaused;
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
        chrome.storage.local.get(['rules', 'isPaused'], (result) => {
            const rules = (result.rules || []).map((rule, index) => normalizeLegacyRule(rule, index));
            const payload = {
                version: 1,
                exportedAt: new Date().toISOString(),
                isPaused: Boolean(result.isPaused),
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

                const normalized = imported.slice(0, MAX_RULES).map((rule, index) => normalizeLegacyRule(rule, index));
                populateRows(normalized);
                if (typeof parsed.isPaused === 'boolean' && isPausedToggle) {
                    isPausedToggle.checked = parsed.isPaused;
                }
                triggerValidation();
                showSuccess('Imported');
            } catch (e) {
                errorMsg.textContent = 'Import failed. Invalid JSON format.';
                errorMsg.style.display = 'block';
            }
        };
        reader.readAsText(file);
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        currentTabUrl = tabs?.[0]?.url || '';
        refreshMatchedByPreview();
    });

    chrome.storage.local.get(['rules', 'isPaused'], (result) => {
        const rules = (result.rules || []).map((rule, index) => normalizeLegacyRule(rule, index));
        if (isPausedToggle) {
            isPausedToggle.checked = Boolean(result.isPaused);
            refreshPauseToggleAppearance();
        }
        populateRows(rules);
        const initial = validateRows(false).rules;
        initialSnapshot = snapshotRules(initial);
        initialPaused = Boolean(result.isPaused);
        refreshSaveState();
    });

    addBtn.addEventListener('click', () => {
        addRow();
        scrollRulesToBottom();
        triggerValidation();
    });

    saveBtn.addEventListener('click', () => {
        const { isValid, rules } = validateRows(true);
        if (!isValid) return;
        saveRules(rules);
    });

    exportBtn.addEventListener('click', exportRules);
    isPausedToggle?.addEventListener('change', triggerValidation);

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
