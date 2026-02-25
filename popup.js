document.addEventListener('DOMContentLoaded', () => {
    const rulesBody = document.getElementById('rules-body');
    const addBtn = document.getElementById('add-row');
    const saveBtn = document.getElementById('save-settings');
    const errorMsg = document.getElementById('validation-error');
    const duplicateMsg = document.getElementById('duplicate-msg');
    
    const MAX_RULES = 20;
    const DEFAULT_COLOR = '#00FF00';


    function addRow(url = '', color = DEFAULT_COLOR) {
        if (rulesBody.children.length >= MAX_RULES) return;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" class="url-input" placeholder="example.com" value="${url}"></td>
            <td><input type="color" class="color-input" value="${color}"></td>
            <td><button class="btn-delete">×</button></td>
        `;

        tr.querySelector('.btn-delete').onclick = () => {
            tr.remove();
            updateAddButtonState();
            if (rulesBody.children.length === 0) addRow();
        };

        rulesBody.appendChild(tr);
        updateAddButtonState();
    }

    function updateAddButtonState() {
        addBtn.disabled = rulesBody.children.length >= MAX_RULES;
    }

    // Завантаження даних
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['rules'], (result) => {
            const rules = result.rules || [];
            if (rules.length === 0) {
                addRow();
            } else {
                rules.forEach(rule => addRow(rule.url, rule.color));
            }
        });
    } else {
        // Fallback для Preview в Canvas
        addRow();
    }

    addBtn.addEventListener('click', () => addRow());

    saveBtn.addEventListener('click', () => {
        errorMsg.style.display = 'none';
        duplicateMsg.style.display = 'none';
        const inputs = document.querySelectorAll('.url-input');
        inputs.forEach(i => i.classList.remove('error'));

        let isValid = true;
        const rules = [];
        const normalizedMap = new Map();

        const rows = Array.from(rulesBody.children);
        
        for (let row of rows) {
            let urlValue = row.querySelector('.url-input').value.trim();
            const colorValue = row.querySelector('.color-input').value;

            if (!urlValue) continue;

            urlValue = urlValue.replace(/,/g, '');
            if (!urlValue.startsWith('http://') && !urlValue.startsWith('https://')) {
                urlValue = 'https://' + urlValue;
            }

            if (urlValue.startsWith('http://')) {
                row.querySelector('.url-input').classList.add('error');
                isValid = false;
                continue;
            }

            try {
                new URL(urlValue);
            } catch (e) {
                row.querySelector('.url-input').classList.add('error');
                isValid = false;
                continue;
            }

            if (normalizedMap.has(urlValue)) {
                row.querySelector('.url-input').classList.add('error');
                normalizedMap.get(urlValue).classList.add('error');
                duplicateMsg.style.display = 'block';
                isValid = false;
            } else {
                normalizedMap.set(urlValue, row.querySelector('.url-input'));
                rules.push({ url: urlValue, color: colorValue });
            }
        }

        if (isValid) {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.set({ rules: rules }, () => {
                    showSuccess();
                });
            } else {
                showSuccess();
                console.log('Saved to memory (Preview mode):', rules);
            }
        } else {
            errorMsg.style.display = 'block';
        }
    });

    function showSuccess() {
        const originalText = saveBtn.innerText;
        saveBtn.innerText = 'Saved!';
        saveBtn.style.background = '#10b981';
        setTimeout(() => {
            saveBtn.innerText = originalText;
            saveBtn.style.background = '';
        }, 1500);
    }
});