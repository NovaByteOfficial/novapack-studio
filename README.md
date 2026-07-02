<div align="center">

<div><img src="./logo.svg" width="100" height="100" alt="NovaByte Logo" /></div>

<div><img src="https://img.shields.io/badge/NovaByte_Studio-v1.1.3-22c55e?style=for-the-badge" alt="NovaByte Studio"/></div>

# NovaByte Studio

**A desktop IDE for building and packaging `.novaapp` applications —**
**compatible with every NBOSP fork and NovaByte OS v3.**

<br>

[![NBOSP Compatible](https://img.shields.io/badge/NBOSP-Compatible-22c55e?style=flat-square)](https://github.com/NovaByteTeam/novabyte-os)
[![v3 Compatible](https://img.shields.io/badge/NovaByte_OS-v3.x.x-22c55e?style=flat-square)](https://github.com/NovaByteTeam/novabyte-os)
[![Node](https://img.shields.io/badge/Node.js-22+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-22c55e?style=flat-square)](#)
[![Downloads](https://img.shields.io/badge/Download-Releases-22c55e?style=flat-square)](https://github.com/NovaByteTeam/novabyte-studio/releases)
[![License](https://img.shields.io/badge/License-All_Rights_Reserved-22c55e?style=flat-square)](#license)

<br>

[**Getting Started**](#getting-started) · [**Manifest Format**](#manifest-format) · [**App Runtime**](#app-runtime) · [**Permissions**](#permissions) · [**Private Storage**](#private-storage) · [**postMessage API**](#postmessage-api) · [**Security**](#security) · [**Distribution**](#distribution)

</div>

---

## What is NovaByte Studio

NovaByte Studio is a desktop IDE (built on NW.js) for creating, building, and packaging `.novaapp` applications. It gives you a GUI to scaffold new projects from templates, edit your code with a full-featured CodeMirror 6 editor, manage your manifest and permissions, build your package, and inspect the output — all without touching a CLI.

Apps you build with Studio run on NovaByte OS v3 and every NBOSP fork. The `.novaapp` format is the same across all of them.

---

## Download

NovaByte Studio is available for Windows, macOS, and Linux. Download the latest release for your platform from the [Releases](https://github.com/NovaByteTeam/novabyte-studio/releases) page, extract the archive, and run the executable — no install required.

---

## Getting Started

### Prerequisites

- Basic HTML, CSS, and JavaScript knowledge

### Available templates

| Template | Description |
|----------|-------------|
| `blank` | Empty shell — start from scratch |
| `webapp` | External URL wrapper |
| `utility` | File-access tool with fs permission wiring |
| `game` | Canvas game skeleton with game loop |
| `dashboard` | Data widget grid with live update pattern |
| `form` | Data entry form with local JSON persistence |
| `markdown-viewer` | Live markdown preview with vendor library support |
| `chat` | Message list UI — client-side state, no permissions needed |

### Bundled external dependencies (`vendor/`)

Every new project includes a `vendor/` directory. Drop single-file libraries there (JS or CSS) and they are bundled automatically when you Build — no CDN required.

```
vendor/
  marked.min.js
  chart.min.js
```

Reference them in your HTML as:

```html
<script src="vendor/marked.min.js"></script>
```

Only copy the final built/minified file you need — don't copy entire `node_modules` folders.

---

## Manifest Format

Every app needs a `manifest.json` at the root of its directory.

### Minimal manifest

```json
{
  "id": "com.example.myapp",
  "name": "My App",
  "version": "1.0.0",
  "entry": "index.html"
}
```

### Full manifest

```json
{
  "id": "com.example.myapp",
  "name": "My App",
  "version": "1.0.0",
  "description": "A short description",
  "author": "Your Name",
  "email": "you@example.com",
  "website": "https://example.com",
  "entry": "index.html",
  "icon": "box",
  "type": "blank",
  "permissions": ["fs:read"],
  "optionalPermissions": ["device:notifications"],
  "defaultSize": [800, 560],
  "minSize": [400, 300],
  "maxSize": [1600, 1200],
  "resizable": true,
  "frame": true,
  "categories": ["utilities"],
  "minSecurityPatch": "2026-05-01"
}
```

### Required fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique app ID — reverse domain format |
| `name` | string | Display name shown in the OS |
| `version` | string | Semantic version `x.y.z` |
| `entry` | string | Main HTML file to load |

### Optional fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `description` | string | — | Short description |
| `author` | string | — | Your name |
| `email` | string | — | Contact email |
| `website` | string | — | Your site |
| `icon` | string | `"box"` | Icon Lucide name, data URI, or URL |
| `type` | string | `"blank"` | App type |
| `permissions` | array | `[]` | Required permissions — user must grant all |
| `optionalPermissions` | array | `[]` | Optional permissions — app must handle denial gracefully |
| `defaultSize` | array | `[800, 560]` | `[width, height]` in pixels |
| `minSize` | array | `[400, 300]` | Minimum window size |
| `maxSize` | array | — | Maximum window size |
| `resizable` | boolean | `true` | Whether the window can be resized |
| `frame` | boolean | `true` | Whether the window has a title bar |
| `categories` | array | `[]` | App categories for filtering |
| `minSecurityPatch` | string | — | Minimum OS patch date (`YYYY-MM-DD`) required to run |

### App ID format

Use reverse domain name notation. The CLI enforces this.

```
✅  com.example.myapp
✅  io.github.username.app
✅  webapp_uniqueid          ← web app shortcut IDs use this prefix instead
❌  MyApp                    ← no uppercase
❌  myapp                    ← needs at least one dot
```

---

## Build process

When you hit Build in Studio, here's what happens under the hood:

- Reads and validates `manifest.json` (or `novaapp.json` — both accepted)
- Validates the app ID format and all declared permissions against the known permission list
- Reads every file in the project directory and Base64-encodes it
- Generates a SHA-256 signature over the manifest + files payload
- Writes `<app.id>.novaapp` to your chosen output directory

---

## Editor

NovaByte Studio includes a full-featured CodeMirror 6 editor with:

- **Multi-tab editing** — VS Code-style pinned/preview tabs with dirty indicators
- **Syntax highlighting** — JavaScript, TypeScript, HTML, CSS, JSON, Markdown and more
- **TypeScript intellisense** — in-process type-aware completion, hover, and linting via `@typescript/vfs` (no server required)
- **Find / Replace** — search panel with next/previous/replace/replace-all
- **Diff / merge view** — side-by-side file comparison
- **Image preview** — inline preview for PNG, JPG, SVG, WebP, ICO
- **Settings** — configurable font size, tab size, and word wrap, persisted per-user
- **Git integration** — file tree badges for modified, added, deleted, and untracked files
- **Context menu** — rename, duplicate, delete, new file/folder, compare files
- **Command palette** — quick access to every action (`Ctrl+Shift+P`)
- **Quick open** — jump to any file (`Ctrl+P`)
- **Global search** — search across all files in the project
- **Workspaces** — save and restore open file sets per project

### Themes

Seven built-in themes: NovaByte Dark, NovaByte Light, Midnight Blue, Amber, Nightshade, High Contrast, and Forest.

---

## App Runtime

When a `.novaapp` is installed and launched, here's what actually happens:

### Install

The App Manager reads the file, validates the manifest fields (`id`, `name`, `version` are required), checks the signature (prompts the user if it fails rather than blocking outright), and saves the app data to `localStorage` under `nova_installed_apps`. It also calls `registerNovaApp()` which registers the app with the OS app registry so it appears in the launcher.

### Launch — permission gate

Before the iframe loads, the runtime checks every permission in `permissions` and `optionalPermissions` against the Permission Manager. Any missing grants are queued and shown one at a time (Android-style). If the user denies a required permission, the app shows a locked screen instead of loading:

```
🔒
This app requires additional permissions to run.
Grant them in Settings → Apps and try again.
```

### Launch — private storage bridge

After permissions pass, the runtime injects a `__novaPrivateStore` shim into the iframe before the app HTML loads. This gives the app isolated, namespaced localStorage access without touching the OS's own keys:

```javascript
// Inside your app's iframe — available immediately, no import needed
window.__novaPrivateStore.get('myKey')        // → value or null
window.__novaPrivateStore.set('myKey', value) // persists across launches
window.__novaPrivateStore.del('myKey')
window.__novaPrivateStore.getVFSDir()         // → VFS directory path for this app
window.__novaPrivateStore.appId               // → 'com.example.myapp'
```

Keys are automatically namespaced to `nova_app_<appId>_<key>` in localStorage — your app can never accidentally read or overwrite another app's data.

### Launch — iframe sandbox

The app HTML runs in a sandboxed iframe with:

```
sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
```

There is no access to the parent window's DOM or JS scope. Communication with the OS happens exclusively through the postMessage API.

---

## Permissions

Permissions are declared in `manifest.json` and checked before the app loads. The user sees a consent dialog for each one. Grants persist across sessions via HMAC-signed localStorage entries. Unused app grants expire after 30 days of inactivity.

### Full permission list

| Permission | Category | Risk |
|------------|----------|------|
| `fs:read` | Filesystem | Medium |
| `fs:write` | Filesystem | High |
| `fs:delete` | Filesystem | Critical |
| `fs:metadata` | Filesystem | Low |
| `net:internal` | Network | Low |
| `net:external` | Network | Medium |
| `net:websocket` | Network | Medium |
| `mail:read` | Email | High |
| `mail:write` | Email | Critical |
| `mail:send` | Email | Critical |
| `mail:delete` | Email | High |
| `calendar:read` | Calendar | Medium |
| `calendar:write` | Calendar | High |
| `calendar:delete` | Calendar | High |
| `contacts:read` | Contacts | Medium |
| `contacts:write` | Contacts | High |
| `device:notifications` | Device | Medium |
| `device:geolocation` | Device | High |
| `device:camera` | Device | Critical |
| `device:microphone` | Device | Critical |
| `system:info` | System | Low |
| `system:settings` | System | High |
| `system:apps` | System | High |
| `data:export` | Data | Medium |
| `data:backup` | Data | High |
| `admin:users` | Admin | Critical |
| `admin:system` | Admin | Critical |
| `admin:audit` | Admin | Critical |

### Required vs optional

```json
{
  "permissions": ["fs:read", "net:internal"],
  "optionalPermissions": ["device:notifications"]
}
```

Required permissions — all must be granted or the app won't load. Optional permissions — the app must handle denial gracefully and still function in a degraded mode.

### Requesting a permission at runtime

From inside your sandboxed app, send a postMessage request:

```javascript
window.parent.postMessage({
  type: 'nova:request-permission',
  permission: 'fs:write',
  reason: 'Needed to save your documents.',
  permanent: true
}, '*');

window.addEventListener('message', (e) => {
  if (e.data.type === 'nova:request-permission:response') {
    console.log(e.data.granted); // true or false
  }
});
```

---

## Private Storage

Every app gets isolated storage through `window.__novaPrivateStore`, injected by the runtime before the iframe loads. Use it instead of touching `localStorage` directly — direct localStorage access will work but keys won't be namespaced, which can conflict with OS data.

```javascript
// Store data
window.__novaPrivateStore.set('settings', { theme: 'dark', fontSize: 14 });

// Read data
const settings = window.__novaPrivateStore.get('settings'); // → { theme: 'dark', fontSize: 14 }

// Delete a key
window.__novaPrivateStore.del('settings');

// Get your app's VFS directory path (for file system operations)
const dir = window.__novaPrivateStore.getVFSDir();
```

Data persists across app launches and OS restarts. It is scoped to your app ID — `nova_app_com.example.myapp_settings` — and completely invisible to other apps.

---

## postMessage API

Apps communicate with the OS via `postMessage`. Every call follows the same request/response pattern:

**Sending a request:**

```javascript
window.parent.postMessage({
  type: 'nova:<category>:<action>',
  // ... payload fields
}, '*');
```

**Receiving the response:**

```javascript
window.addEventListener('message', (e) => {
  if (e.data.type === 'nova:<category>:<action>:response') {
    if (e.data.error) {
      console.error(e.data.error.code, e.data.error.message);
    } else {
      console.log(e.data.result);
    }
  }
});
```

### Handshake — `nova:ready`

Send this on startup. The OS responds with your app's metadata and granted permissions.

```javascript
window.parent.postMessage({
  type: 'nova:ready',
  appId: 'com.example.myapp'
}, '*');

// Response
{
  success: true,
  appId: 'com.example.myapp',
  permissions: ['fs:read', 'device:notifications'],
  optionalPermissions: ['net:external'],
  osVersion: '3.0.0',
  securityPatch: '2026-05-01'
}
```

### Filesystem — `nova:fs:*`

All filesystem operations require the appropriate `fs:*` permission.

```javascript
// Read a file (requires fs:read)
window.parent.postMessage({ type: 'nova:fs:read', path: '/docs/notes.txt' }, '*');
// Response: { result: { content: '...', size: 1234, modified: '...' } }

// Write a file (requires fs:write)
window.parent.postMessage({ type: 'nova:fs:write', path: '/docs/notes.txt', content: 'Hello' }, '*');

// Delete a file (requires fs:delete)
window.parent.postMessage({ type: 'nova:fs:delete', path: '/docs/notes.txt' }, '*');
```

### Notifications — `nova:notify:*`

```javascript
// Show a notification (requires device:notifications)
window.parent.postMessage({
  type: 'nova:notify:show',
  title: 'Done',
  body: 'Your file was saved.',
  appName: 'My App'
}, '*');

// Clear all notifications (requires device:notifications)
window.parent.postMessage({ type: 'nova:notify:clear' }, '*');
```

### Clipboard — `nova:clipboard:*`

```javascript
// Read clipboard (requires fs:read)
window.parent.postMessage({ type: 'nova:clipboard:read' }, '*');
// Response: { result: { text: '...' } }

// Write clipboard (requires fs:read)
window.parent.postMessage({ type: 'nova:clipboard:write', text: 'Hello' }, '*');
```

### Window — `nova:window:*`

```javascript
// Close this window
window.parent.postMessage({ type: 'nova:window:close' }, '*');

// Minimize
window.parent.postMessage({ type: 'nova:window:minimize' }, '*');

// Maximize / restore
window.parent.postMessage({ type: 'nova:window:maximize' }, '*');

// Set title
window.parent.postMessage({ type: 'nova:window:setTitle', title: 'My App — Editing' }, '*');

// Resize
window.parent.postMessage({ type: 'nova:window:resize', width: 1200, height: 800 }, '*');

// Get current state
window.parent.postMessage({ type: 'nova:window:getState' }, '*');
// Response: { result: { width, height, x, y, maximized, minimized } }
```

### App launcher — `nova:app:*`

```javascript
// Launch another app (requires system:apps)
window.parent.postMessage({ type: 'nova:app:launch', appId: 'com.example.otherapp' }, '*');

// Get info about an app (requires system:apps)
window.parent.postMessage({ type: 'nova:app:info', appId: 'com.example.otherapp' }, '*');
```

### Network — `nova:net:fetch`

```javascript
// External request (requires net:external)
window.parent.postMessage({
  type: 'nova:net:fetch',
  url: 'https://api.example.com/data',
  method: 'GET',
  headers: { 'Accept': 'application/json' }
}, '*');
```

### Geolocation — `nova:device:geolocation`

```javascript
// Requires device:geolocation
window.parent.postMessage({ type: 'nova:device:geolocation' }, '*');
// Response: { result: { latitude, longitude, accuracy } }
```

### System info — `nova:system:info`

```javascript
// Requires system:info
window.parent.postMessage({ type: 'nova:system:info' }, '*');
// Response: { result: { osVersion, securityPatch, platform, ... } }
```

### Event bus — `nova:events:*`

```javascript
// Subscribe to an OS event
window.parent.postMessage({ type: 'nova:events:subscribe', event: 'theme:change' }, '*');

// Unsubscribe
window.parent.postMessage({ type: 'nova:events:unsubscribe', event: 'theme:change' }, '*');
```

### Storage — `nova:storage:*`

Per-app key-value storage via the OS bridge (alternative to `__novaPrivateStore`):

```javascript
window.parent.postMessage({ type: 'nova:storage:set', key: 'myKey', value: 'myValue' }, '*');
window.parent.postMessage({ type: 'nova:storage:get', key: 'myKey' }, '*');
window.parent.postMessage({ type: 'nova:storage:delete', key: 'myKey' }, '*');
window.parent.postMessage({ type: 'nova:storage:clear' }, '*');
window.parent.postMessage({ type: 'nova:storage:keys' }, '*');
```

### File picker — `nova:dialog:*`

```javascript
// Open file picker
window.parent.postMessage({
  type: 'nova:dialog:open',
  accept: ['.txt', '.md'],
  multiple: false
}, '*');
// Response: { result: { path, name, content } }

// Save file picker
window.parent.postMessage({
  type: 'nova:dialog:save',
  filename: 'notes.txt',
  content: 'Hello'
}, '*');
```

### Error codes

| Code | Meaning |
|------|---------|
| `PERMISSION_DENIED` | Required permission not granted |
| `INVALID_ARGS` | Missing or invalid payload fields |
| `NOT_FOUND` | File or resource not found |
| `QUOTA_EXCEEDED` | Storage limit reached |
| `NETWORK_ERROR` | Fetch failed |

---

## Security

### Security Update API

Apps can declare a minimum OS security patch level required to run. The OS checks this automatically at launch — you don't need to write any runtime code for it.

**Automatic enforcement** — apps that declare any of these permissions are checked automatically regardless of `minSecurityPatch`. The OS patch must be no older than 180 days:

| Permission | Risk |
|------------|------|
| `fs:write` | High |
| `fs:delete` | Critical |
| `device:geolocation` | High |
| `system:settings` | High |
| `admin:system` | Critical |

**Explicit declaration** — add `minSecurityPatch` to your manifest to require a specific date. Recommended for any app that handles passwords, tokens, encryption keys, or personal data:

```json
{
  "minSecurityPatch": "2026-05-01"
}
```

If the user's OS patch is older than required, an unskippable dialog appears with a 6-second countdown and closes the window automatically. The user is directed to Settings → Updates. The dialog cannot be dismissed or bypassed.

**Trigger a security check from inside your app:**

```javascript
// Useful for protecting specific actions like unlocking a vault
window.parent.postMessage({
  type: 'nova:security:check',
  minPatchDate: '2026-05-01',
  reason: 'Required to store encrypted passwords safely.'
}, '*');

window.addEventListener('message', (e) => {
  if (e.data.type === 'nova:security:result') {
    console.log(e.data.compliant); // true or false
    console.log(e.data.current);   // '2026-05-01'
    console.log(e.data.required);  // '2026-05-01'
    // If compliant is false, the OS already showed the blocking dialog
    // and closed the window — you don't need to handle it yourself
  }
});
```

### Best practices

- Request the minimum permissions your app actually needs
- Handle optional permission denial gracefully — the app should still function
- Declare `minSecurityPatch` for any app handling credentials or sensitive data
- Don't use `eval()` — use safer alternatives
- Validate and sanitize all user input and any file content you read
- Don't collect data you don't need

---

## Package format

A standard (non-obfuscated) `.novaapp` file is plain JSON:

```json
{
  "novabyte_app": true,
  "compiled_at": 1700000000000,
  "manifest": { "id": "...", "name": "...", "version": "...", "entry": "...", "permissions": [] },
  "files": {
    "index.html": "<base64-encoded content>",
    "app.js": "<base64-encoded content>"
  },
  "signature": "<sha256 hex string>"
}
```

File contents are Base64-encoded. The signature is a SHA-256 hash over the `novabyte_app`, `manifest`, `files`, and `compiled_at` fields. The runtime verifies this on install and warns the user if it doesn't match — it doesn't block installation outright.

---

## Distribution

### Direct distribution

Share the `.novaapp` file directly. Users drag and drop it into the App Manager, or click Install and pick the file. That's the whole install flow — no separate installer, no admin rights required.

Provide a checksum alongside the file so users can verify integrity before installing:

```bash
sha256sum com.example.myapp.novaapp
```

### Updates

There's no built-in update pipeline in NBOSP. The simplest approach is a GitHub Releases pipeline:

1. Bump `version` in `manifest.json`
2. Build and tag a release
3. Attach the `.novaapp` to the release
4. Tell your users to re-download and reinstall

When a user installs an app that's already installed, the App Manager detects the version conflict and prompts them to replace it.

---

## Compatibility

Any `.novaapp` package built with this SDK installs and runs on:

- NovaByte OS v3.x.x
- NBOSP (any version, any fork)

The package format hasn't changed between v2.3.8 and v3. As long as a fork ships `app-package.js` and the App Manager, your package will work. The only thing that can break compatibility is declaring a `minSecurityPatch` date that the target OS hasn't reached — which is intentional.

---

## License

All Rights Reserved. NovaByte Studio and all associated assets are proprietary software.