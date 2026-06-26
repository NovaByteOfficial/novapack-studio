const path = require('path');
const fs = require('fs');
const express = require('express');

/**
 * NovaByte Modular Server Entry
 */
require('dotenv').config();

const app = express();

const { validateEnvironment } = require('./env');
const { configureSSL } = require('./ssl');
const { setupMiddleware } = require('../middleware');
const { mountRoutes } = require('../routes');
const { setupFaviconRoutes } = require('../favicons');
const { setupSuggestProxy, setupEmailImageProxy, setupFrameCheckProxy } = require('../proxies');

// Root of the whole project, two levels up from this file. Defined once so
// every other path in this file is built from the same source of truth.
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// These are assigned later in the file but declared here, as plain `let`s
// with no initializer, so the crash handlers below can safely reference them
// even if something throws before they're set. A `const`/`let` declared
// further down would still be in its temporal dead zone at that point and
// throw a ReferenceError instead of just being `undefined`.
let server;
let shuttingDown = false;
let indexHtmlWatcher;
let _appServeRegistryPruneInterval;

function forceExitAfterShutdownTimeout() {
    console.error('[Shutdown] Forced exit after timeout');
    process.exit(1);
}

function gracefulShutdown(signal) {
    if (shuttingDown) return; // a second SIGTERM, or a crash mid-shutdown, shouldn't restart this
    shuttingDown = true;

    console.log(`\n[${signal}] Received. Starting graceful shutdown...`);

    indexHtmlWatcher?.close();
    clearInterval(_appServeRegistryPruneInterval);

    if (!server) {
        // Something failed before the server ever came up — nothing to close.
        process.exit(1);
        return;
    }

    server.close(() => {
        console.log('[HTTP] Server closed');
        process.exit(0);
    });

    setTimeout(forceExitAfterShutdownTimeout, 10_000);
}

// Anything that reaches these has left the process in an unknown state.
// Logging and carrying on risks serving traffic from a half-broken app, so
// we shut down cleanly instead and let the process manager restart us.
process.on('uncaughtException', (error) => {
    process.stderr.write(`[uncaughtException] ${error?.stack || error}\n`);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
    process.stderr.write(`[unhandledRejection] ${reason?.stack || reason}\n`);
    gracefulShutdown('unhandledRejection');
});

// Env validation has to happen before anything below can assume it's safe.
try {
    validateEnvironment();
} catch (e) {
    console.error(e);
    process.exit(1);
}

setupMiddleware(app);

// index.html is cached in memory and only re-read when the file changes, so
// a normal request never touches disk. Everything in this block, and the
// routes right after it, has to be registered before the static middleware
// further down — otherwise a direct request for one of these paths gets
// served raw by the static handler instead.
const INDEX_HTML_PATH = path.join(PROJECT_ROOT, 'index.html');
let _indexHtmlRaw = null;

async function getIndexHtml() {
    if (_indexHtmlRaw === null) {
        _indexHtmlRaw = await fs.promises.readFile(INDEX_HTML_PATH, 'utf8');
    }
    return _indexHtmlRaw;
}

indexHtmlWatcher = fs.watch(INDEX_HTML_PATH, () => {
    _indexHtmlRaw = null;
});
indexHtmlWatcher.on('error', (error) => {
    // Worst case we keep serving a stale cached copy (or fall back to
    // reading from disk) until the next restart — not worth crashing over.
    process.stderr.write(`[indexHtmlWatcher] ${error?.stack || error}\n`);
});

function escapeHtmlAttribute(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function serveIndex(req, res) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    let html = await getIndexHtml();

    // Inject CSRF token meta tag — the only runtime injection needed.
    // Escaped because this lands inside an HTML attribute; an unescaped
    // token containing a `"` could break out of it.
    const csrfToken = escapeHtmlAttribute(req.session?.csrfToken || res.locals.csrfToken || '');
    html = html.replace('</head>', `<meta name="csrf-token" content="${csrfToken}"></head>`);

    res.send(html);
}

// Both URLs serve the exact same processed HTML, so a direct link to
// /index.html still gets the CSRF token and no-cache headers instead of a
// stale raw file.
app.get('/', serveIndex);
app.get('/index.html', serveIndex);

app.get('/manifest.json', (req, res) => {
    res.json({
        name: 'NovaByte',
        short_name: 'NovaByte',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f0f0f',
        theme_color: '#0f0f0f',
        icons: []
    });
});

app.get('/version.json', async (req, res) => {
    const versionPath = path.join(PROJECT_ROOT, 'version.json');
    try {
        await fs.promises.access(versionPath);
        return res.sendFile(versionPath);
    } catch {
        res.status(404).json({ error: 'version.json not found' });
    }
});

// Served explicitly from project root, rather than through the static
// middleware, so we can force fresh fetches (or, for trackers.js, a longer
// cache) regardless of whatever the static middleware would do by default.
app.get('/app.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(PROJECT_ROOT, 'app.js'));
});

app.get('/ui-init.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(PROJECT_ROOT, 'ui-init.js'));
});

app.get('/trackers.js', async (req, res) => {
    const p = path.join(PROJECT_ROOT, 'trackers.js');
    try {
        await fs.promises.access(p);
    } catch {
        return res.status(404).json({ error: 'trackers.js not found — run the generator script' });
    }
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(p);
});

app.get('/style.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(PROJECT_ROOT, 'style.css'));
});

setupFaviconRoutes(app);
setupSuggestProxy(app);
setupEmailImageProxy(app);
setupFrameCheckProxy(app);

function healthCheck(req, res) {
    res.status(200).json({ status: 'ok' });
}
app.get('/health', healthCheck);
app.get('/api/health', healthCheck);

app.get('/api/security/strip-tracking', (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'url parameter is required' });
    }

    let urlObj;
    try {
        urlObj = new URL(decodeURIComponent(url));
    } catch {
        return res.status(400).json({ error: 'Invalid URL' });
    }

    if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return res.status(400).json({ error: 'Only http and https URLs are supported' });
    }

    // The URL parser returns IPv6 literals wrapped in brackets (e.g. "[::1]"),
    // so brackets have to come off before comparing against the blocklist
    // below — otherwise every IPv6 entry in it is dead weight that never
    // matches. This is still just a best-effort blocklist, not a substitute
    // for a real egress allowlist if this URL is ever fetched server-side.
    const h = urlObj.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const BLOCKED = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
    const BLOCKED_PREFIXES = ['10.', '192.168.',
        '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.',
        '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.',
        '172.28.', '172.29.', '172.30.', '172.31.',
        '169.254.', '100.64.',
        'fe80:', 'fc00:', 'fd00:'];
    if (BLOCKED.includes(h) || BLOCKED_PREFIXES.some(p => h.startsWith(p)) || h.endsWith('.local') || h.endsWith('.internal')) {
        return res.status(400).json({ error: 'Internal URLs are not permitted' });
    }

    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content',
        'utm_term', 'fbclid', 'gclid', 'mc_eid', 'mc_cid', '_hsenc', '_hsmi'];
    let stripped = false;
    trackingParams.forEach(param => {
        if (urlObj.searchParams.has(param)) {
            urlObj.searchParams.delete(param);
            stripped = true;
        }
    });
    res.json({ stripped, url: urlObj.toString() });
});

mountRoutes(app);

// Stub endpoints for prefetch-manager — it polls these even though NovaByte
// doesn't implement the underlying features yet.
app.get('/api/apps/list', (req, res) => res.json([]));
app.get('/api/apps/registry', (req, res) => res.json({}));
app.get('/api/apps/permissions', (req, res) => res.json([]));
app.get('/api/security/status', (req, res) => res.json({ ok: true }));
app.get('/api/security/sandbox-check', (req, res) => res.json({ sandboxed: true }));
app.get('/api/user/profile', (req, res) => res.json({}));
app.get('/api/user/preferences', (req, res) => res.json({}));
app.get('/api/user/sessions', (req, res) => res.json([]));
app.get('/api/files/list', (req, res) => res.json([]));
app.get('/api/files/search', (req, res) => res.json([]));
app.get('/api/files/metadata', (req, res) => res.json({}));

// In-memory registry for serving packaged .novaapp sandbox files.
// sandboxId → { files: Map<filename, base64>, created: ms }
// Used by webview sandboxes to serve packaged .novaapp files under their own
// relaxed CSP. Entries expire after 30 minutes, on top of explicit cleanup
// when a sandbox is destroyed.
const _appServeRegistry = new Map();
const _APP_SERVE_TTL = 30 * 60 * 1000; // 30 min
const _APP_SERVE_PRUNE_INTERVAL = 5 * 60 * 1000; // sweep for expired entries this often
const _APP_SERVE_MAX_SANDBOXES = 200; // hard ceiling on concurrent sandboxes
const _APP_SERVE_MAX_FILES_PER_SANDBOX = 500;
const _APP_SERVE_MAX_BYTES_PER_SANDBOX = 50 * 1024 * 1024; // base64 text length, not decoded size

function _pruneAppServeRegistry() {
    const cutoff = Date.now() - _APP_SERVE_TTL;
    for (const [id, entry] of _appServeRegistry) {
        if (entry.created < cutoff) _appServeRegistry.delete(id);
    }
}
// Registrations prune on their way in, but if a sandbox happens to be the
// last one ever registered, nothing else triggers cleanup — so also sweep
// on a timer, the same way the memory monitor below does.
_appServeRegistryPruneInterval = setInterval(_pruneAppServeRegistry, _APP_SERVE_PRUNE_INTERVAL).unref();

// Register app files for serving (called by app-sandbox.js loadAppContent)
app.post('/api/apps/serve/register', (req, res) => {
    const { sandboxId, files } = req.body || {};
    if (!sandboxId || typeof sandboxId !== 'string' || !files || typeof files !== 'object') {
        return res.status(400).json({ error: 'sandboxId (string) and files (object) are required' });
    }
    // sandboxId must match our internal format to prevent registry pollution
    if (!/^sandbox_[\w.-]+_\d+$/.test(sandboxId)) {
        return res.status(400).json({ error: 'Invalid sandboxId format' });
    }

    const entries = Object.entries(files);
    if (entries.length === 0) {
        return res.status(400).json({ error: 'files must contain at least one entry' });
    }
    if (entries.length > _APP_SERVE_MAX_FILES_PER_SANDBOX) {
        return res.status(400).json({ error: `files exceeds the ${_APP_SERVE_MAX_FILES_PER_SANDBOX}-file limit` });
    }

    let totalBytes = 0;
    for (const [name, content] of entries) {
        if (typeof content !== 'string') {
            return res.status(400).json({ error: `file "${name}" must be a base64 string` });
        }
        totalBytes += content.length;
    }
    if (totalBytes > _APP_SERVE_MAX_BYTES_PER_SANDBOX) {
        return res.status(400).json({ error: 'files exceed the per-sandbox size limit' });
    }

    _pruneAppServeRegistry();
    if (!_appServeRegistry.has(sandboxId) && _appServeRegistry.size >= _APP_SERVE_MAX_SANDBOXES) {
        return res.status(503).json({ error: 'Too many active sandboxes, try again shortly' });
    }

    // Stored as a Map, not the plain object that came off the wire — a
    // plain object lookup later (entry.files[filePath]) would resolve keys
    // like "__proto__" through the prototype chain instead of treating them
    // as missing, which is exactly the kind of thing an attacker would try
    // against a sandboxId/path they don't otherwise have access to.
    _appServeRegistry.set(sandboxId, { files: new Map(entries), created: Date.now() });
    res.json({ ok: true, baseUrl: `/api/apps/serve/${sandboxId}` });
});

// Unregister (called on sandbox destroy)
app.delete('/api/apps/serve/unregister/:sandboxId', (req, res) => {
    _appServeRegistry.delete(req.params.sandboxId);
    res.json({ ok: true });
});

const MIME = {
    html: 'text/html', js: 'text/javascript', mjs: 'text/javascript',
    css: 'text/css', json: 'application/json',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
    ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2'
};

// Serve app files with a relaxed CSP.
// The webview's separate renderer process provides the real isolation boundary.
// server-sent CSP header takes effect (replaces the main page's strict policy).
app.get('/api/apps/serve/:sandboxId/{*file}', (req, res) => { // <-- Valid stable Express 5 syntax
    const entry = _appServeRegistry.get(req.params.sandboxId);
    if (!entry) return res.status(404).end();

    const raw = req.params.file;
    const filePath = Array.isArray(raw) ? raw.join('/') : (raw || 'index.html');

    const fileData = entry.files.get(filePath);
    if (!fileData) return res.status(404).end();

    const ext = filePath.split('.').pop().toLowerCase();
    // hasOwn guards the same prototype-chain issue as the Map above —
    // MIME['constructor'] or MIME['__proto__'] would otherwise return a
    // truthy inherited value instead of falling through to the default.
    const contentType = Object.hasOwn(MIME, ext) ? MIME[ext] : 'application/octet-stream';

    // Relaxed CSP for third-party apps — unsafe-inline/eval allowed because:
    //   1. webview process isolation is the real security boundary
    //   2. connect-src 'none' still blocks direct exfiltration; all network goes through IPC
    if (ext === 'html') {
        res.setHeader('Content-Security-Policy', [
            "default-src 'self' blob: data: 'unsafe-inline' 'unsafe-eval'",
            "script-src 'self' blob: 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline' blob: data:",
            "img-src 'self' blob: data: https:",
            "font-src 'self' blob: data:",
            "connect-src 'none'"
        ].join('; '));
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(fileData, 'base64'));
});

function logMemoryUsage() {
    const m = process.memoryUsage();
    const mb = v => Math.round(v / 1024 / 1024);
    process.stdout.write(
        `[Memory] heapUsed=${mb(m.heapUsed)}MB heapTotal=${mb(m.heapTotal)}MB rss=${mb(m.rss)}MB external=${mb(m.external)}MB\n`
    );
    if (typeof global.gc === 'function' && m.heapUsed / m.heapTotal > 0.85 && m.heapUsed > 100 * 1024 * 1024) {
        global.gc();
        process.stdout.write('[Memory] gc() triggered - heap was above 85%\n');
    }
}
setInterval(logMemoryUsage, 60_000).unref();

// Static asset delivery, mounted last and scoped to specific subdirectories
// on purpose. There used to be a catch-all express.static(PROJECT_ROOT) here
// — note that express.static doesn't even support an "ignore" option, so the
// `{ ignore: ['index.html'] }` it was called with was silently doing nothing
// — which served the entire project directory (server source, package.json,
// everything outside dotfiles) to any client. Every root-level file that's
// actually meant to be public already has an explicit route above; if you
// add another one later (robots.txt, sitemap.xml, etc.), give it its own
// route too rather than bringing back a project-root mount.
const isDevelopment = process.env.NODE_ENV !== 'production';
const cacheOptions = {
    maxAge: isDevelopment ? '1m' : '1d',
    etag: true,
    immutable: !isDevelopment
};
const jsCacheOptions = {
    maxAge: isDevelopment ? 0 : '1d',
    etag: true,
    immutable: !isDevelopment
};

app.use('/assets', express.static(path.join(PROJECT_ROOT, 'assets'), cacheOptions));
app.use('/js', express.static(path.join(PROJECT_ROOT, 'js'), jsCacheOptions));
app.use('/css', express.static(path.join(PROJECT_ROOT, 'css'), cacheOptions));

app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', message: `Cannot ${req.method} ${req.path}`, timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
    console.error('[Error]', err);
    // If headers are already sent, the original request already got a response —
    // this error surfaced asynchronously afterward (e.g. a session store write that
    // failed after res.json() already ran). Writing again here is what throws
    // ERR_HTTP_HEADERS_SENT. Just log and hand off to Node's default handling.
    if (res.headersSent) {
        return next(err);
    }
    const message = process.env.NODE_ENV === 'production'
        ? 'An internal server error occurred'
        : err.message;
    res.status(err.status || 500).json({
        error: message || err.message || 'Internal Server Error',
        timestamp: new Date().toISOString()
    });
});

server = configureSSL(app).server;

const PORT = Number.parseInt(process.env.PORT, 10) || 3003;
const HOST = process.env.HOST || '127.0.0.1';

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`[Server] Port ${PORT} is already in use.`);
        console.error(`  Stop the existing process, or set a different port: PORT=3001 npm start`);
    } else {
        console.error('Server error:', error.message);
    }
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

server.listen(PORT, HOST, () => {
    const isHttps = process.env.HTTPS === 'true';
    const protocol = isHttps ? 'https' : 'http';
    try {
        const pkg = require(path.join(PROJECT_ROOT, 'package.json'));
        console.log('');
        console.log(`  NovaByte v${pkg.version}`);
    } catch {
        console.log('');
        console.log(`  NovaByte`);
    }
    console.log('  ──────────────────────────────────');
    console.log(`  ● Address      ${protocol}://${HOST}:${PORT}`);
    console.log(`  ● Environment  ${process.env.NODE_ENV || 'development'}`);
    console.log(`  ● TLS          ${isHttps ? 'enabled (HTTPS)' : 'disabled (HTTP)'}`);
    console.log('  ──────────────────────────────────');
    console.log('');
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.maxRequestsPerSocket = 1000;

module.exports = { app, server };