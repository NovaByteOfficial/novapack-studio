registerApp({
  id: 'studio.devtools',
  name: 'Dev Tools',
  icon: 'studio-devtools',
  description: 'Studio developer flags and OS utilities',
  defaultSize: [420, 400],
  minSize: [380, 340],
  resizable: false,

  init(content) {
    const DEV_FLAGS = {
      verboseLogging: { label: 'Verbose Logging',        default: false },
      windowBorders:  { label: 'Show Window Borders',    default: false },
      disableSandbox: { label: 'Disable App Sandbox',    default: false },
      showFPS:        { label: 'Show FPS Counter',       default: false },
      logPermissions: { label: 'Log Permission Requests',default: false },
    };

    const load = () => { try { return JSON.parse(localStorage.getItem('nova_dev_flags') || '{}'); } catch { return {}; } };
    const save = f  => localStorage.setItem('nova_dev_flags', JSON.stringify(f));

    function apply(flags) {
      document.documentElement.style.setProperty(
        '--dev-window-border', flags.windowBorders ? '2px solid #22c55e' : 'none'
      );
      if (flags.verboseLogging && !window._devVerbose) {
        window._devVerbose = true;
        ['log','warn','error'].forEach(m => {
          const o = console[m].bind(console);
          console[m] = (...a) => o('[VERBOSE]', ...a);
        });
      }
      if (flags.showFPS && !window._devFPS) {
        window._devFPS = true;
        const el = Object.assign(document.createElement('div'), {
          id: '_dev_fps',
          style: 'position:fixed;bottom:8px;right:8px;background:#000a;color:#22c55e;font:11px monospace;padding:2px 6px;border-radius:4px;z-index:99999;pointer-events:none;'
        });
        document.body.appendChild(el);
        let last = performance.now(), frames = 0;
        const tick = () => {
          frames++;
          const now = performance.now();
          if (now - last >= 500) { el.textContent = `${Math.round(frames * 1000 / (now - last))} fps`; frames = 0; last = now; }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } else if (!flags.showFPS) {
        document.getElementById('_dev_fps')?.remove();
        window._devFPS = false;
      }
    }

    const flags = load();
    apply(flags);

    content.style.cssText = 'font-family:var(--font-ui,system-ui);background:var(--bg-base);color:var(--text-primary);height:100%;display:flex;flex-direction:column;padding:18px;box-sizing:border-box;gap:6px;';
    content.innerHTML = `
      <div style="font-size:13px;font-weight:700;color:var(--accent,#22c55e);letter-spacing:.06em;margin-bottom:2px;">DEV TOOLS</div>
      <div style="font-size:11px;color:var(--text-muted,#64748b);margin-bottom:14px;">Flags apply immediately and persist across sessions.</div>
      <div id="df" style="display:flex;flex-direction:column;gap:10px;flex:1;"></div>
      <div style="border-top:1px solid var(--border-default,#1e293b);padding-top:14px;display:flex;gap:8px;">
        <button id="dt-clear" style="background:transparent;color:var(--red,#f87171);border:1px solid var(--red,#f87171);padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px;">Clear App Storage</button>
        <button id="dt-reload" style="background:transparent;color:var(--accent,#22c55e);border:1px solid var(--accent,#22c55e);padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px;">Reload OS</button>
      </div>
    `;

    const df = content.querySelector('#df');
    for (const [key, meta] of Object.entries(DEV_FLAGS)) {
      const checked = flags[key] ?? meta.default;
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;';
      label.innerHTML = `<input type="checkbox" data-flag="${key}" ${checked ? 'checked' : ''} style="width:15px;height:15px;accent-color:var(--accent,#22c55e);cursor:pointer;"><span>${meta.label}</span>`;
      df.appendChild(label);
    }

    df.addEventListener('change', e => {
      if (!e.target.dataset.flag) return;
      const f = load();
      f[e.target.dataset.flag] = e.target.checked;
      save(f); apply(f);
    });

    content.querySelector('#dt-clear').addEventListener('click', () => {
      if (confirm('Clear all app localStorage? Cannot be undone.')) { localStorage.clear(); alert('Done.'); }
    });
    content.querySelector('#dt-reload').addEventListener('click', () => location.reload());
  }
});