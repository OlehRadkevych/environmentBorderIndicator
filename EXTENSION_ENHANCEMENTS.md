# Chrome Extension Analysis and Enhancement Backlog

## Current implementation snapshot

The extension is compact and easy to reason about:

- **Manifest V3** popup + content-script architecture.
- **Rule storage** uses `chrome.storage.local`.
- **Matching strategy** compares current hostname with the saved rule hostname and optionally matches path prefixes.
- **UI** allows adding/deleting up to 20 rules with color pickers and duplicate validation.

This keeps the extension lightweight, but a few changes would significantly improve reliability, UX, and maintainability.

---

## Priority enhancements

### 1) Make indicators react to SPA route changes and storage updates
**Why:** `content.js` applies the border once at load time, so route changes in single-page apps can leave stale indicators.

**Suggested approach:**
- Listen for `history.pushState`, `history.replaceState`, and `popstate` to re-run matching.
- Add a `chrome.storage.onChanged` listener so if the user edits rules while tab is open, the border updates immediately.
- Add logic to remove/repaint an existing overlay if the matching rule changes.

**Impact:** High correctness improvement with low complexity.

### 2) Improve rule matching precision and flexibility
**Why:** Current match only checks exact hostname + optional path prefix.

**Suggested approach:**
- Add explicit match modes per rule: `exact host`, `subdomain wildcard`, `host + path prefix`, `regex (advanced)`.
- Normalize and compare using URL components (`hostname`, `pathname`, optional `port`) consistently.
- Clarify whether query params should be included (usually no).

**Impact:** High user value for teams with complex environments.

### 3) Add border style controls (thickness, position, label)
**Why:** A plain 10px border works, but many teams need richer context cues.

**Suggested approach:**
- Per-rule options: border thickness, dashed/solid style, and optional corner label (`PROD`, `STAGE`, etc.).
- Add a text badge with configurable contrast and fixed corner position.

**Impact:** High UX and safety improvement.

### 4) Strengthen popup validation and feedback
**Why:** Validation is mostly correct, but feedback can be made clearer.

**Suggested approach:**
- Show row-level error messages (invalid URL, HTTP disallowed, duplicate rule).
- Canonicalize URLs before duplicate check (lowercase host, trim trailing slash for path rules where needed).
- Disable Save when there are no meaningful changes.

**Impact:** Medium UX improvement.

### 5) Add import/export of rule sets
**Why:** Teams often share environment maps across devices and users.

**Suggested approach:**
- Add JSON export and import in popup.
- Validate schema/version before importing.
- Optionally support merge vs replace strategy.

**Impact:** High practical value for QA/dev teams.

---

## Engineering quality enhancements

### 6) Refactor shared URL utilities
Extract URL normalization and match logic into reusable utility modules to avoid drift between popup validation and content matching.

### 7) Add automated tests
- Unit tests for normalization/matching edge cases.
- Minimal integration tests for popup save/validation flows.

### 8) Add TypeScript + lint/format tooling
TypeScript (or JSDoc typedefs) plus ESLint/Prettier would reduce runtime errors and keep logic consistent.

### 9) Improve i18n and accessibility
- Externalize strings for localization.
- Add keyboard/focus states and ARIA labeling for popup controls.

### 10) Consider optional `storage.sync`
Offer a toggle between local-only and Chrome sync storage so rules can follow the user across devices.

---

## Security and permissions observations

- The extension currently uses `<all_urls>` content script matching. Consider reducing scope where feasible or documenting why full scope is required.
- Keep strict input validation before writing rules to storage.
- Continue avoiding external network calls (already a strength).

---

## Suggested delivery roadmap

### Phase 1 (quick wins)
1. SPA + storage live updates.
2. Overlay repaint/removal logic.
3. Better row-level validation errors.

### Phase 2
1. Match-mode options.
2. Import/export.
3. Border label + style customization.

### Phase 3
1. Testing harness.
2. TypeScript migration.
3. Accessibility + localization pass.

---

## Expected outcome

With the Phase 1 + 2 enhancements, this extension would move from a useful visual helper to a robust environment-safety tool suitable for team-wide adoption.
