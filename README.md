# 🌐 Environment Border Indicator

**Environment Border Indicator** is a lightweight Google Chrome extension designed to help developers, QA engineers, and power users distinguish between various web environments (e.g., Production, Staging, UAT, Local) at a glance.

By drawing a customizable **10px colored border** around the viewport, it prevents accidental actions in the wrong environment.

---

## ✨ Key Features

- 🎯 **Visual Cues:** Instantly see a 10px colored border overlay on matching sites.
- ⚙️ **Fully Configurable:** Add, edit, or delete up to 20 custom environment rules.
- 🧹 **Smart Normalization:** Automatically handles URL inputs (trims spaces, prepends `https://`, cleans separators).
- 🚀 **High Performance:** Minimal impact on browser performance. The border is a fixed overlay that doesn't shift the page layout.
- 🛡️ **Secure:** Operates only on user-defined URLs. No data is sent to external servers; everything is stored locally in your browser storage.

---

## 🛠 Project Structure

- `manifest.json` — Extension configuration (Manifest V3).
- `popup.html` — The settings dashboard UI.
- `popup.js` — Core logic for rule management, validation, and storage.
- `content.js` — The script responsible for URL matching and rendering the border.

---

## 📦 Installation Guide

Since this is a developer version of the extension, follow these steps to install it:

### 1. Download the Project

Clone the repository to your local machine:

```bash
git clone https://github.com/OlehRadkevych/environmentBorderIndicator.git
```
Alternatively, download the source code as a ZIP and extract it to a preferred folder.

---

## 2. Enable Developer Mode

1. Open Google Chrome.
2. Go to `chrome://extensions/`.
3. In the top-right corner, toggle **Developer mode** to **On**.

---

## 3. Load the Extension

1. Click the **Load unpacked** button.
2. Select the folder containing the project files (where the `manifest.json` is located).

The **Environment Border Indicator** should now appear in your list of extensions.

---

## 📖 How to Use

- **Pin the Icon:** Click the extensions (puzzle) icon in Chrome and pin the indicator for quick access.
- **Open Settings:** Click the extension icon to open the configuration table.
- **Add Rules:**
  1. Enter a domain or subdomain (e.g., `test.example.com` or `localhost`).
  2. Pick a color using the visual palette.
  3. Click **Save**.
- **See it in Action:** Navigate to the site you configured or refresh an already open tab to see the border.

---

## ⚠️ Important Considerations

- **Protocol:** The extension is optimized for `https://` sites. While `http://` might work on local environments, browser security policies often restrict extension injection on non-secure sites.
- **Reserved Pages:** Chrome security prevents extensions from running on internal pages (`chrome://`), the Chrome Web Store, or system settings.
- **Z-Index:** The border uses a maximum z-index (`2147483647`) to stay on top of most web elements. However, some elements with specific stacking contexts might still overlap it.
- **Incognito:** To use this in Incognito mode, you must explicitly enable **Allow in Incognito** in the extension settings page.

---

## 🤝 Contributing

Contributions are welcome! If you have ideas for new features (like regex support or sync capabilities), feel free to open an issue or submit a pull request.

**Created for QA, by QA.**