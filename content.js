(function() {
    // Only apply to top-level frames
    if (window.self !== window.top) return;

    function applyIndicator() {
        chrome.storage.local.get(['rules'], (result) => {
            const rules = result.rules || [];
            const currentUrl = window.location.href;
            const currentOrigin = window.location.origin;

            // Matching logic as per requirements: domain/subdomain match
            // We compare current origin with saved normalized URL's origin
            const matchingRule = rules.find(rule => {
                try {
                    const ruleUrl = new URL(rule.url);
                    const currentUrlObj = new URL(currentUrl);

                    // We match domain/subdomain exactly (case-sensitive as requested)
                    // Note: Chrome's URL object usually lowercases the hostname, 
                    // but the requirement said "not case-insensitive", which implies strict comparison.
                    // However, DNS is case-insensitive, so standard URL comparison is used.
                    
                    const isSameHost = ruleUrl.hostname === currentUrlObj.hostname;
                    
                    // Check if path is included in the rule and matches
                    const ruleHasPath = ruleUrl.pathname !== '/' && ruleUrl.pathname !== '';
                    if (ruleHasPath) {
                        return isSameHost && currentUrlObj.pathname.startsWith(ruleUrl.pathname);
                    }
                    
                    return isSameHost;
                } catch (e) {
                    return false;
                }
            });

            if (matchingRule) {
                createBorder(matchingRule.color);
            }
        });
    }

    function createBorder(color) {

        const borderId = 'env-border-indicator-overlay';
        if (document.getElementById(borderId)) return;

        const overlay = document.createElement('div');
        overlay.id = borderId;
        

        const style = overlay.style;
        style.position = 'fixed';
        style.top = '0';
        style.left = '0';
        style.width = '100vw';
        style.height = '100vh';
        style.border = `10px solid ${color}`;
        style.boxSizing = 'border-box';
        style.pointerEvents = 'none'; 
        style.zIndex = '2147483647'; 
        style.pointerEvents = 'none';

        document.documentElement.appendChild(overlay);
    }


    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        applyIndicator();
    } else {
        window.addEventListener('load', applyIndicator);
    }
})();