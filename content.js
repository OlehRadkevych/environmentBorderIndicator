(function() {
    if (window.self !== window.top) return;

    const OVERLAY_ID = 'env-border-indicator-overlay';
    const LABEL_ID = 'env-border-indicator-label';

    function normalizeLegacyRule(rule = {}) {
        if (rule.pattern) {
            return {
                matchType: rule.matchType || 'exact',
                pattern: String(rule.pattern),
                color: rule.color || '#00ff00',
                label: rule.label || '',
                borderStyle: rule.borderStyle || 'solid',
                borderThickness: Number(rule.borderThickness) || 10
            };
        }

        if (!rule.url) return null;

        try {
            const parsed = new URL(rule.url);
            const hasPath = parsed.pathname && parsed.pathname !== '/';
            return {
                matchType: hasPath ? 'path' : 'exact',
                pattern: hasPath ? `${parsed.hostname}${parsed.pathname}` : parsed.hostname,
                color: rule.color || '#00ff00',
                label: rule.label || '',
                borderStyle: rule.borderStyle || 'solid',
                borderThickness: Number(rule.borderThickness) || 10
            };
        } catch (e) {
            return null;
        }
    }

    function clearIndicator() {
        document.getElementById(OVERLAY_ID)?.remove();
        document.getElementById(LABEL_ID)?.remove();
    }

    function ensureLeadingSlash(pathname) {
        if (!pathname) return '/';
        return pathname.startsWith('/') ? pathname : `/${pathname}`;
    }

    function hostMatchesWildcard(host, patternHost) {
        const cleanPattern = patternHost.toLowerCase().replace(/^\*\./, '');
        return host === cleanPattern || host.endsWith(`.${cleanPattern}`);
    }

    function ruleMatchesCurrent(rule, currentUrlObj) {
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

    function createLabel(rule) {
        if (!rule.label) return;

        const label = document.createElement('div');
        label.id = LABEL_ID;
        label.textContent = rule.label;
        const style = label.style;
        style.position = 'fixed';
        style.top = '12px';
        style.right = '12px';
        style.zIndex = '2147483647';
        style.padding = '6px 10px';
        style.background = rule.color;
        style.color = '#111827';
        style.borderRadius = '6px';
        style.fontSize = '12px';
        style.fontWeight = '700';
        style.letterSpacing = '0.03em';
        style.pointerEvents = 'none';
        style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';

        document.documentElement.appendChild(label);
    }

    function createBorder(rule) {
        clearIndicator();

        const overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        const style = overlay.style;
        style.position = 'fixed';
        style.top = '0';
        style.left = '0';
        style.width = '100vw';
        style.height = '100vh';
        style.border = `${Math.min(Math.max(Number(rule.borderThickness) || 10, 2), 40)}px ${rule.borderStyle || 'solid'} ${rule.color || '#00ff00'}`;
        style.boxSizing = 'border-box';
        style.pointerEvents = 'none';
        style.zIndex = '2147483647';

        document.documentElement.appendChild(overlay);
        createLabel(rule);
    }

    function applyIndicator() {
        chrome.storage.local.get(['rules'], (result) => {
            const rules = (result.rules || []).map(normalizeLegacyRule).filter(Boolean);
            const currentUrlObj = new URL(window.location.href);
            const matchingRule = rules.find((rule) => {
                try {
                    return ruleMatchesCurrent(rule, currentUrlObj);
                } catch (e) {
                    return false;
                }
            });

            if (matchingRule) {
                createBorder(matchingRule);
            } else {
                clearIndicator();
            }
        });
    }

    function installSpaListeners() {
        const originalPushState = history.pushState;
        history.pushState = function() {
            const result = originalPushState.apply(this, arguments);
            applyIndicator();
            return result;
        };

        const originalReplaceState = history.replaceState;
        history.replaceState = function() {
            const result = originalReplaceState.apply(this, arguments);
            applyIndicator();
            return result;
        };

        window.addEventListener('popstate', applyIndicator);
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.rules) {
            applyIndicator();
        }
    });

    installSpaListeners();

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        applyIndicator();
    } else {
        window.addEventListener('load', applyIndicator);
    }
})();
