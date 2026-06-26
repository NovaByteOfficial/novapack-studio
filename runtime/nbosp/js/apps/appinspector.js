registerApp({
  id: 'studio.appinspector',
  name: 'App Inspector',
  icon: 'studio-appinspector',
  description: 'Inspect installed apps — manifest, permissions, launch stats',
  defaultSize: [620, 460],
  minSize: [500, 360],

  init(content) {
    content.style.cssText = 'display:flex;height:100%;font-family:var(--font-ui,system-ui);background:var(--bg-base);color:var(--text-primary);box-sizing:border-box;';
    content.innerHTML = `
      <div style="width:180px;border-right:1px solid var(--border-default,#1e293b);display:flex;flex-direction:column;flex-shrink:0;">
        <div style="padding:10px;border-bottom:1px solid var(--border-default,#1e293b);">
          <input id="ai-search" placeholder="Search apps…" style="width:100%;box-sizing:border-box;background:var(--bg-elevated);border:1px solid var(--border-default);color:var(--text-primary);padding:5px 8px;border-radius:6px;font-size:12px;outline:none;">
        </div>
        <div id="ai-list" style="overflow-y:auto;flex:1;"></div>
      </div>
      <div id="ai-detail" style="flex:1;padding:16px;overflow-y:auto;font-size:12px;">
        <div style="color:var(--text-muted,#64748b);text-align:center;margin-top:60px;">Select an app</div>
      </div>
    `;

    const list   = content.querySelector('#ai-list');
    const detail = content.querySelector('#ai-detail');
    const search = content.querySelector('#ai-search');

    const tag = t => `<span style="background:var(--bg-elevated);border:1px solid var(--border-default);padding:2px 7px;border-radius:4px;font-size:11px;margin:2px;">${t}</span>`;
    const stat = (l, v) => `<div style="background:var(--bg-overlay);border:1px solid var(--border-default);border-radius:6px;padding:7px 10px;"><div style="font-size:10px;color:var(--text-muted);margin-bottom:2px;">${l}</div><div>${v}</div></div>`;

    function showApp(app) {
      const size = app.defaultSize ? `${app.defaultSize[0]} × ${app.defaultSize[1]}` : '—';
      const minSize = app.minSize ? `${app.minSize[0]} × ${app.minSize[1]}` : '—';
      const resizable = app.resizable === false ? 'No' : 'Yes';

      // AppRegistry apps have extra fields; registerApp apps don't
      const hasStats = app.launchCount != null || app.installedDate || app.lastLaunched;

      detail.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
          <div style="width:40px;height:40px;border-radius:10px;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;">${typeof svgIcon === 'function' ? svgIcon(app.icon, 24) : `<span style="font-size:22px;">${app.icon || '📦'}</span>`}</div>
          <div>
            <div style="font-size:14px;font-weight:600;">${app.name}</div>
            <div style="font-size:11px;color:var(--text-muted);">${app.id}</div>
          </div>
        </div>
        ${app.description ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;line-height:1.5;">${app.description}</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px;">
          ${stat('Default Size', size)}
          ${stat('Min Size',     minSize)}
          ${stat('Resizable',    resizable)}
          ${stat('Type',         app.type || (app.init ? 'built-in' : '—'))}
          ${hasStats ? stat('Launches', app.launchCount || 0) : ''}
          ${hasStats ? stat('Last Launched', (app.lastLaunched || '').slice(0,10) || 'never') : ''}
          ${app.author ? stat('Author', app.author) : ''}
          ${app.version ? stat('Version', app.version) : ''}
          ${app.verified != null ? stat('Verified', app.verified ? '✅ yes' : '❌ no') : ''}
        </div>
        ${app.permissions?.length ? `
        <div style="margin-bottom:10px;">
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px;">Permissions</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">${app.permissions.map(tag).join('')}</div>
        </div>` : ''}
        ${app.categories?.length ? `
        <div style="margin-bottom:14px;">
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px;">Categories</div>
          <div>${app.categories.map(tag).join('')}</div>
        </div>` : ''}
        <button data-launch style="background:var(--accent,#22c55e);color:#000;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">Launch</button>
      `;
      detail.querySelector('[data-launch]').addEventListener('click', () => WM.createWindow(app.id));
    }

    function getAllKnownApps() {
      const seen = new Map();
      for (const a of APP_REGISTRY) seen.set(a.id, a);
      if (typeof AppRegistry !== 'undefined') {
        for (const a of AppRegistry.getAllApps()) if (!seen.has(a.id)) seen.set(a.id, a);
      }
      return [...seen.values()];
    }

    function renderList(filter = '') {
      const apps = getAllKnownApps().filter(a =>
        !filter || a.name.toLowerCase().includes(filter.toLowerCase()) || a.id.includes(filter.toLowerCase())
      );
      list.innerHTML = apps.map(a => `
        <div data-id="${a.id}" style="padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border-default);display:flex;align-items:center;gap:8px;">
          <span style="font-size:16px;display:flex;align-items:center;">${typeof svgIcon === 'function' ? svgIcon(a.icon, 16) : (a.icon || '📦')}</span>
          <div>
            <div style="font-size:12px;font-weight:500;">${a.name}</div>
            <div style="font-size:10px;color:var(--text-muted);">${a.id}</div>
          </div>
        </div>
      `).join('') || '<div style="padding:12px;color:var(--text-muted);font-size:12px;">No apps found</div>';

      list.querySelectorAll('[data-id]').forEach(el => {
        el.addEventListener('click', () => {
          list.querySelectorAll('[data-id]').forEach(e => e.style.background = '');
          el.style.background = 'var(--bg-elevated)';
          const app = getAllKnownApps().find(a => a.id === el.dataset.id);
          if (app) showApp(app);
        });
      });
    }

    search.addEventListener('input', () => renderList(search.value));
    renderList();
  }
});