// Patch console immediately at load time so boot logs are captured
// before the app window is ever opened
if (!window._studioConsolePatched) {
  window._studioConsolePatched = true;
  window._studioConsoleFeed = [];
  const _MAX = 500;
  ["log","warn","error","info","debug"].forEach(level => {
    const orig = console[level].bind(console);
    console[level] = (...args) => {
      orig(...args);
      const entry = { level, text: args.map(a => {
        try { return typeof a === "object" ? JSON.stringify(a, null, 2) : String(a); }
        catch { return String(a); }
      }).join(" "), t: Date.now() };
      window._studioConsoleFeed.push(entry);
      if (window._studioConsoleFeed.length > _MAX) window._studioConsoleFeed.shift();
      window.dispatchEvent(new CustomEvent("studio:console", { detail: entry }));
    };
  });
}

registerApp({
  id: 'studio.console',
  name: 'Console',
  icon: 'studio-console',
  description: 'Live console output — intercepts log, warn, error from all apps',
  defaultSize: [580, 420],
  minSize: [420, 300],

  init(content) {

    const COLORS = { log: 'var(--text-primary,#e2e8f0)', warn: '#fbbf24', error: '#f87171', info: '#60a5fa', debug: 'var(--text-muted,#64748b)' };

    content.style.cssText = 'display:flex;flex-direction:column;height:100%;font-family:var(--font-mono,monospace);background:var(--bg-base);color:var(--text-primary);box-sizing:border-box;';
    content.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border-default,#1e293b);flex-shrink:0;">
        <select id="cv-filter" style="background:var(--bg-elevated);border:1px solid var(--border-default);color:var(--text-primary);padding:3px 7px;border-radius:5px;font-size:11px;outline:none;">
          <option value="">All</option>
          <option value="log">log</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
          <option value="debug">debug</option>
        </select>
        <input id="cv-search" placeholder="Filter…" style="flex:1;background:var(--bg-elevated);border:1px solid var(--border-default);color:var(--text-primary);padding:3px 8px;border-radius:5px;font-size:11px;outline:none;">
        <label style="font-size:11px;display:flex;align-items:center;gap:4px;cursor:pointer;">
          <input type="checkbox" id="cv-tail" checked style="accent-color:var(--accent,#22c55e);"> Tail
        </label>
        <button id="cv-clear" style="background:transparent;border:1px solid var(--border-default);color:var(--text-muted);padding:3px 9px;border-radius:5px;cursor:pointer;font-size:11px;">Clear</button>
      </div>
      <div id="cv-log" style="flex:1;overflow-y:auto;padding:6px 0;"></div>
    `;

    const log    = content.querySelector('#cv-log');
    const filter = content.querySelector('#cv-filter');
    const search = content.querySelector('#cv-search');
    const tail   = content.querySelector('#cv-tail');

    function fmtTime(ts) {
      const d = new Date(ts);
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}.${String(d.getMilliseconds()).padStart(3,'0')}`;
    }

    function addEntry(entry) {
      const lv  = filter.value;
      const kw  = search.value.toLowerCase();
      if (lv && entry.level !== lv) return;
      if (kw && !entry.text.toLowerCase().includes(kw)) return;

      const row = document.createElement('div');
      row.style.cssText = `display:flex;gap:8px;padding:2px 12px;font-size:11px;color:${COLORS[entry.level] || COLORS.log};border-bottom:1px solid var(--border-default,#1e293b)22;white-space:pre-wrap;word-break:break-all;`;
      row.innerHTML = `<span style="color:var(--text-muted);flex-shrink:0;">${fmtTime(entry.t)}</span><span style="flex-shrink:0;width:36px;opacity:.7;">${entry.level}</span><span>${entry.text.replace(/</g,'&lt;')}</span>`;
      log.appendChild(row);

      // Keep DOM lean
      while (log.children.length > 500) log.removeChild(log.firstChild);
      if (tail.checked) log.scrollTop = log.scrollHeight;
    }

    function rebuild() {
      log.innerHTML = '';
      (window._studioConsoleFeed || []).forEach(addEntry);
    }

    const handler = e => addEntry(e.detail);
    window.addEventListener('studio:console', handler);

    filter.addEventListener('change', rebuild);
    search.addEventListener('input',  rebuild);
    content.querySelector('#cv-clear').addEventListener('click', () => {
      window._studioConsoleFeed = [];
      log.innerHTML = '';
    });

    // Cleanup when app window closes
    content._studioCleanup = () => window.removeEventListener('studio:console', handler);

    rebuild();
  }
});