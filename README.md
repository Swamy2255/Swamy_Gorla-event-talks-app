# BigQuery Release Radar 📡

A premium, high-fidelity developer dashboard to monitor, search, filter, and share Google BigQuery release notes. Built with Python Flask, BeautifulSoup, and vanilla HTML/CSS/JavaScript.

---

## ✨ Features

- **High-Fidelity UI**: Modern dark theme with glowing accents, glassmorphic cards (`backdrop-filter`), hover micro-animations, and custom scrollbars.
- **Intelligent XML Parser**: Splits daily feed groups into individual release items, categorizing them into:
  - 🟢 **Features**
  - 🟡 **Announcements**
  - 🔵 **Changes**
  - 🔴 **Deprecated / Issues**
- **Performance Caching**: Implements a 10-minute in-memory caching system to minimize external feed calls and accelerate page loads, with an optional force-refresh parameter.
- **Interactive Timeline**:
  - Search entries instantly by text or date.
  - Filter updates using category tabs.
  - Highlight selected cards with glowing border animations.
- **Sleek X (Twitter) Composer**:
  - An inline modal previewing the post layout.
  - Formats tweet contents, clipping the text body dynamically to stay within limits.
  - **Smart Char Count**: Follows X's character weighting rules by counting any URL link as exactly 23 characters.
  - Includes a dynamic SVG progress ring displaying remaining character boundaries.

---

## 🛠️ Technology Stack

- **Backend**: Python 3, Flask, Requests, BeautifulSoup4, ElementTree.
- **Frontend**: Plain Vanilla HTML5, CSS3 (variables, transitions, grid layouts), JavaScript (ES6+, Async/Await, SVG progress rings).
- **Icons**: FontAwesome v6 (loaded via CDN).
- **Typography**: Google Fonts (Outfit & Fira Code).

---

## 📁 File Structure

- 🖥️ [app.py](file:///D:/Antigravity%20Files/agy-cli-projects/bq-releases-notes/app.py): The Flask backend application containing the XML/Atom feed parser, route API definitions, and cache manager.
- 📄 [templates/index.html](file:///D:/Antigravity%20Files/agy-cli-projects/bq-releases-notes/templates/index.html): Responsive dashboard structure, loading layouts, search systems, filter selectors, and modal nodes.
- 🎨 [static/css/style.css](file:///D:/Antigravity%20Files/agy-cli-projects/bq-releases-notes/static/css/style.css): Styling guidelines, design vars, glassmorphism filters, scrollbars, and keyframes.
- ⚙️ [static/js/app.js](file:///D:/Antigravity%20Files/agy-cli-projects/bq-releases-notes/static/js/app.js): Search mechanics, clipboard utilities, custom event listeners, and Twitter Composer state management.
- 🚫 [.gitignore](file:///D:/Antigravity%20Files/agy-cli-projects/bq-releases-notes/.gitignore): Files and folders excluded from version tracking.

---

## 🚀 Getting Started

### Prerequisites
Make sure you have Python 3 and pip installed.

### 1. Install Dependencies
Install Flask, Requests, and BeautifulSoup4:
```bash
pip install flask requests beautifulsoup4
```

### 2. Run the Application
Start the development server:
```bash
python app.py
```

### 3. Open in Browser
Open your browser and navigate to:
```text
http://127.0.0.1:5000
```

---

## 🐦 Twitter Character Count Logic
Twitter/X counts character boundaries differently than simple text limits:
- Normal characters count as 1.
- **All URL links count as exactly 23 characters**, regardless of length, due to Twitter's mandatory `t.co` link shortener.

The Javascript inside [app.js](file:///D:/Antigravity%20Files/agy-cli-projects/bq-releases-notes/static/js/app.js) correctly parses input and subtracts weights accordingly:
```javascript
function calculateTweetLength(text) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    const rawTextWithoutUrls = text.replace(urlRegex, "");
    const urlMatches = text.match(urlRegex) || [];
    return rawTextWithoutUrls.length + (urlMatches.length * 23);
}
```
This guarantees that the preview count inside the composer fits perfectly when you hit **Post to X**.
