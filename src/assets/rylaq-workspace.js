/*
 * rylaq-workspace.js — application shell: header, universal search, module
 * rail, detail drawer, modals, command palette, status bar and boot.
 *
 * EMBEDDING: the whole app renders inside <main id="rylaq-workspace"
 * class="rylaq-workspace">. All CSS is scoped to .rylaq-workspace, so the
 * shell can be pasted into a CMS/intranet page without touching host styles.
 * To adopt RYLAQ global CSS, override the --rq-* custom properties.
 */
(function (R) {
  'use strict';
  const { h, clear, icon, extLink, fmt, announce } = R.util;
  const ui = R.ui;

  let root, contentEl, railEl, statusEl, searchInput, detectEl, modalLayer;
  let lastFocus = null;
  const shell = (R.shell = { visibleTaskKeys: new Set() });

  /* ------------------------------- theme ------------------------------- */
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function applyTheme() {
    const p = R.state.prefs.theme;
    const dark = p === 'dark' || (p === 'system' && mq && mq.matches);
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.setAttribute('data-density', R.state.prefs.density);
  }
  shell.applyTheme = applyTheme;
  if (mq && mq.addEventListener) mq.addEventListener('change', () => root && applyTheme());

  /* ------------------------------ modals ------------------------------ */
  function trapFocus(container, e) {
    const f = [...container.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null || x === document.activeElement);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  /**
   * Open an accessible dialog. kind: 'modal' | 'drawer' | 'palette'.
   * Focus is trapped while open and returned to the trigger on close.
   */
  shell.openDialog = function (title, body, kind, opts) {
    shell.closeDialog();
    lastFocus = document.activeElement;
    const id = R.util.uid('dlg');
    const closeBtn = h('button', { type: 'button', class: 'rq-icon-btn', 'aria-label': 'Close dialog', onclick: () => shell.closeDialog() }, icon('close'));
    const panel = h(
      'div',
      { class: 'rq-dialog rq-dialog-' + (kind || 'modal'), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id, tabindex: '-1' },
      h('div', { class: 'rq-dialog-head' }, h('h2', { id, class: 'rq-h2' }, title), closeBtn),
      h('div', { class: 'rq-dialog-body' }, body)
    );
    const backdrop = h('div', { class: 'rq-backdrop', onclick: (e) => e.target === backdrop && shell.closeDialog() }, panel);
    panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        shell.closeDialog();
      } else if (e.key === 'Tab') trapFocus(panel, e);
    });
    modalLayer.appendChild(backdrop);
    root.classList.add('rq-has-dialog');
    setTimeout(() => {
      const target = (opts && opts.focus && panel.querySelector(opts.focus)) || closeBtn;
      target.focus();
    }, 20);
    return panel;
  };
  shell.closeDialog = function () {
    if (!modalLayer || !modalLayer.firstChild) return;
    clear(modalLayer);
    root.classList.remove('rq-has-dialog');
    if (lastFocus && lastFocus.isConnected) lastFocus.focus();
    lastFocus = null;
  };

  /** Open an official link-out from a command (same rel/target policy as extLink). */
  shell.openExternal = function (url) {
    const a = extLink(url, 'external');
    a.style.display = 'none';
    root.appendChild(a);
    a.click();
    a.remove();
  };

  /** Detail drawer for any record. */
  shell.openDetail = function (r) {
    const body = h(
      'div',
      { class: 'rq-detail' },
      h('div', { class: 'rq-card-badges' }, ...r.badges.map((b) => ui.badge(b.text, b.tone)), ui.confidence(r.prov.confidence)),
      r.subtitle ? h('p', { class: 'rq-card-sub' }, r.subtitle) : null,
      r.summary ? ui.readMore(r.summary, 600) : null,
      ui.kv(r.fields),
      r.links && r.links.length ? h('div', { class: 'rq-row' }, ...r.links.map((l) => extLink(l.href, l.label))) : null,
      h('h3', { class: 'rq-h3' }, 'Provenance'),
      ui.kv([
        ['Source', r.prov.sourceName],
        ['Endpoint / record type', r.prov.endpoint],
        ['Source record ID', r.prov.recordId || 'Not reported by source'],
        ['Retrieved at (this session only)', r.prov.retrievedAt.toISOString()],
        ['Data category', r.prov.category],
        ['Match confidence', r.prov.confidence || 'Not applicable'],
        ['Attribution', r.prov.attribution]
      ]),
      h(
        'div',
        { class: 'rq-row' },
        r.prov.url ? extLink(r.prov.url, 'Open official source', { cls: 'rq-btn rq-btn-primary' }) : null,
        ui.button('Pin to evidence board', () => ui.pin(r), { icon: 'pin' }),
        r.kind === 'legal-entity' || r.kind === 'filer' ? ui.button('Explore relationships', () => {
          shell.closeDialog();
          R.explorer && R.explorer.focus(r);
          shell.go('relationships');
        }, { icon: 'tree' }) : null
      ),
      ui.warning(R.legal.determinations, 'info')
    );
    shell.openDialog(r.title, body, 'drawer');
  };

  /* ------------------------------ header ------------------------------ */
  function logo() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 32 32');
    svg.setAttribute('class', 'rq-logo-mark');
    svg.setAttribute('aria-hidden', 'true');
    const paths = [
      ['rect', { x: 2, y: 2, width: 28, height: 28, rx: 7, fill: 'var(--rq-navy)' }],
      ['path', { d: 'M9 23V9h7.2c3 0 5 1.8 5 4.4 0 2-1.2 3.4-3 4l3.6 5.6h-3.5l-3.2-5.1H12V23H9zm3-7.8h4c1.3 0 2.2-.7 2.2-1.8S17.3 11.6 16 11.6h-4v3.6z', fill: '#fff' }],
      ['circle', { cx: 23.5, cy: 23.5, r: 2.5, fill: 'var(--rq-teal)' }]
    ];
    paths.forEach(([t, a]) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', t);
      Object.entries(a).forEach(([k, v]) => el.setAttribute(k, v));
      svg.appendChild(el);
    });
    return svg;
  }

  const PILLS = [
    'Acme Supplier', 'Acme Reinsurer', 'Port of Rotterdam', 'Port of Singapore', 'Malaysia', 'HS 8542.31', 'CVE-2024-3094', 'CISA KEV', 'CPSC recall', 'NHTSA recall', 'TED tender', 'USAspending award',
    'Federal Register rule', 'OFAC search', 'SAM exclusion', 'World Bank LPI', 'semiconductor', 'battery materials', 'packaging resins', 'rare earth magnets', 'cyber insurance', 'marine cargo', 'D&O insurance',
    'professional indemnity', 'property insurance', 'casualty insurance', 'reinsurance', 'cat bond', 'captive', 'broker panel tender', 'insurance claims platform RFP', 'UN procurement', 'World Bank procurement',
    'ADB tender', 'AfDB procurement', 'IDB procurement', 'EBRD procurement', 'EU funding and tenders', 'PPP concession', 'infrastructure project', 'modern slavery registry', 'ISO 27001', 'NIST CSF',
    'OECD due diligence', 'sanctions list search', 'export control entity list', 'counterparty financial fragility', 'public filing stress', 'insolvency registry', 'lien judgment', 'FX risk', 'interest rate risk',
    'commodity risk', 'sovereign risk', 'insurance financial strength', 'reinsurance counterparty risk', 'trade finance exposure', 'project finance risk'
  ];

  function buildHeader() {
    const privacyBadge = h('button', { type: 'button', class: 'rq-privacy-badge', onclick: () => shell.openPrivacy(), 'aria-label': 'RYLAQ Privacy: open privacy details' }, icon('lock', 'rq-icon-sm'), h('span', null, R.legal.privacyBadge));
    const themeBtn = h('button', { type: 'button', class: 'rq-icon-btn', 'aria-label': 'Toggle dark mode (not saved)', onclick: () => {
      const cur = root.getAttribute('data-theme');
      R.state.prefs.theme = cur === 'dark' ? 'light' : 'dark';
      applyTheme();
      announce('Theme changed for this session.');
    } }, icon('moon'));
    return h(
      'header',
      { class: 'rq-header' },
      h(
        'div',
        { class: 'rq-brand' },
        logo(),
        h('div', null, h('div', { class: 'rq-wordmark' }, 'RYLAQ'), h('h1', { class: 'rq-title' }, 'RYLAQ Global Risk, Finance, Insurance & Procurement Intelligence Workspace'), h('p', { class: 'rq-tagline' }, 'Public-source triage for global risk, finance, insurance/reinsurance counterparties, procurement, bids, awards, regulations, events, and supply-chain exposure.'))
      ),
      h(
        'div',
        { class: 'rq-header-actions' },
        privacyBadge,
        h(
          'div',
          { class: 'rq-row rq-row-tight' },
          ui.button('Help', () => shell.openHelp(), { icon: 'help', cls: 'rq-btn-sm' }),
          ui.button('Privacy', () => shell.openPrivacy(), { icon: 'shield', cls: 'rq-btn-sm' }),
          ui.button('Legal', () => shell.openLegal(), { icon: 'doc', cls: 'rq-btn-sm' }),
          h('button', { type: 'button', class: 'rq-btn rq-btn-sm', 'aria-label': 'Open command palette (Ctrl or Command + K)', onclick: () => shell.openPalette() }, icon('command', 'rq-icon-sm'), h('span', null, 'Commands'), h('kbd', { class: 'rq-kbd' }, 'Ctrl K')),
          themeBtn,
          ui.button('Clear Session', () => shell.clearSession(), { icon: 'trash', variant: 'danger', cls: 'rq-btn-sm' })
        )
      )
    );
  }

  function buildSearch() {
    searchInput = h('input', {
      id: 'rq-search',
      class: 'rq-search-input',
      type: 'search',
      maxlength: '140',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      'aria-describedby': 'rq-search-help rq-confidential',
      placeholder: 'Search companies, insurers, reinsurers, brokers, captives, LEIs, tickers, CIKs, countries, ports, HS codes, CVEs, tenders, bids, awards, grants, PPPs, recalls, regulations, finance risk types, or procurement concepts...'
    });
    const form = h(
      'form',
      { class: 'rq-search', role: 'search', 'aria-label': 'Universal search', onsubmit: (e) => {
        e.preventDefault();
        shell.search(searchInput.value);
      } },
      h('label', { for: 'rq-search', class: 'rq-sr' }, 'Universal search'),
      h('div', { class: 'rq-search-field' }, icon('search', 'rq-search-icon'), searchInput),
      h('button', { type: 'submit', class: 'rq-btn rq-btn-primary rq-btn-lg' }, 'Investigate')
    );
    const pills = h('div', { class: 'rq-pills', role: 'list', 'aria-label': 'Example searches' }, ...PILLS.map((p) => h('button', { type: 'button', class: 'rq-pill', role: 'listitem', onclick: () => {
      searchInput.value = p;
      shell.search(p);
    } }, p)));
    let expanded = false;
    const more = h('button', { type: 'button', class: 'rq-link-btn', 'aria-expanded': 'false', onclick: () => {
      expanded = !expanded;
      pills.classList.toggle('is-expanded', expanded);
      more.textContent = expanded ? 'Fewer examples' : 'More examples';
      more.setAttribute('aria-expanded', String(expanded));
    } }, 'More examples');
    detectEl = h('div', { class: 'rq-detect', 'aria-live': 'polite' });
    return h(
      'div',
      { class: 'rq-search-wrap' },
      form,
      h('p', { id: 'rq-search-help', class: 'rq-helper' }, 'Try an insurer, reinsurer, broker, supplier, LEI, ticker, CIK, country, port, HS code, CVE, tender, award, grant, PPP, recall, regulation, finance risk type, or procurement concept.'),
      h('p', { id: 'rq-confidential', class: 'rq-confidential' }, icon('warn', 'rq-icon-xs'), R.legal.sensitiveWarning),
      h('div', { class: 'rq-pills-wrap' }, pills, more),
      detectEl
    );
  }

  /* -------------------------- detection banner -------------------------- */
  function renderDetection() {
    clear(detectEl);
    const s = R.state.session;
    if (!s) return;
    const c = s.chosen;
    const alts = s.detection.candidates.filter((x) => x.type !== c.type).slice(0, 6);
    const wrong = h('details', { class: 'rq-wrong' }, h('summary', null, 'Was this wrong? Choose another interpretation'), h('div', { class: 'rq-row' }, ...alts.map((a) => ui.button(`${a.label} (${a.confidence})`, () => shell.search(s.query, a.type), { cls: 'rq-btn-sm' })), ...['organization', 'country', 'port', 'riskDomain', 'procurement'].filter((t) => t !== c.type && !alts.some((a) => a.type === t)).map((t) => ui.button(R.pipeline.TYPES[t], () => shell.search(s.query, t), { cls: 'rq-btn-sm rq-btn-ghost' }))));
    detectEl.appendChild(
      h(
        'div',
        { class: 'rq-detect-card' },
        h('span', { class: 'rq-muted' }, 'Interpreted as'),
        ui.badge(c.label, 'org'),
        ui.badge('Confidence: ' + c.confidence, c.confidence === 'High' ? 'ok' : c.confidence === 'Medium' ? 'warn' : 'neutral'),
        h('span', { class: 'rq-muted rq-detect-reason' }, c.reason),
        wrong
      )
    );
    if (c.type === 'person') detectEl.appendChild(ui.warning('RYLAQ does not support searches about private individuals and does not aggregate personal data. For compliance screening of named persons, use official sanctions lists and your organization’s screening system of record.', 'red', 'Person search restricted.'));
  }

  /* ------------------------------- rail ------------------------------- */
  function buildRail() {
    railEl = h('nav', { class: 'rq-rail', 'aria-label': 'Workspace modules' });
    renderRail();
    railEl.addEventListener('keydown', (e) => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
      const btns = [...railEl.querySelectorAll('.rq-rail-item')];
      const i = btns.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      const n = e.key === 'Home' ? 0 : e.key === 'End' ? btns.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length;
      btns[n].focus();
    });
    return railEl;
  }
  function renderRail() {
    clear(railEl);
    const toggle = h('button', { type: 'button', class: 'rq-rail-toggle rq-btn rq-btn-sm', 'aria-expanded': 'false', onclick: () => {
      const open = !railEl.classList.contains('is-open');
      railEl.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    } }, icon('menu', 'rq-icon-sm'), h('span', null, 'Modules'));
    railEl.appendChild(toggle);
    const s = R.state.session;
    const lenses = s ? new Set(s.lenses || []) : new Set();
    R.modules.GROUPS.forEach((g) => {
      if (R.state.prefs.hiddenGroups.has(g.id)) return;
      const mods = R.modules.all().filter((m) => m.group === g.id);
      if (!mods.length) return;
      const gid = R.util.uid('grp');
      railEl.appendChild(
        h(
          'div',
          { class: 'rq-rail-group' },
          h('h2', { id: gid, class: 'rq-rail-heading' }, g.label),
          h(
            'ul',
            { 'aria-labelledby': gid },
            ...mods.map((m) =>
              h(
                'li',
                null,
                h(
                  'button',
                  { type: 'button', class: 'rq-rail-item' + (R.state.currentModule === m.id ? ' is-active' : ''), 'aria-current': R.state.currentModule === m.id ? 'page' : null, onclick: () => shell.go(m.id, { focus: true }) },
                  icon(m.icon || 'info', 'rq-icon-sm'),
                  h('span', null, m.short || m.title),
                  lenses.has(m.id) ? h('span', { class: 'rq-rail-dot', title: 'Relevant to current query' }, h('span', { class: 'rq-sr' }, ' (relevant to current query)')) : null
                )
              )
            )
          )
        )
      );
    });
  }
  shell.renderRail = renderRail;

  /* ----------------------------- navigation ----------------------------- */
  shell.go = function (id, opts) {
    const m = R.modules.get(id) || R.modules.get('overview');
    R.state.currentModule = m.id;
    renderRail();
    renderModule(opts && opts.focus);
    if (railEl.classList.contains('is-open')) railEl.classList.remove('is-open');
  };
  function ctx() {
    const s = R.state.session;
    return {
      session: s,
      q: s ? s.query : '',
      type: s ? s.chosen.type : null,
      chosen: s ? s.chosen : null,
      primary: s ? s.primary : null,
      resolved: s ? s.resolved : {},
      name: s ? (s.primary && s.primary.data && s.primary.data.name) || s.resolved.entityName || s.chosen.orgName || s.query : ''
    };
  }
  shell.ctx = ctx;
  function renderModule(focus) {
    const m = R.modules.get(R.state.currentModule);
    // Preserve focus/caret for filter inputs across in-place re-renders.
    const ae = document.activeElement;
    const focusKey = ae && contentEl.contains(ae) && ae.dataset ? ae.dataset.focusKey : null;
    const caret = focusKey && typeof ae.selectionStart === 'number' ? ae.selectionStart : null;
    const scrollY = window.scrollY;
    clear(contentEl);
    shell.visibleTaskKeys = new Set();
    const hid = R.util.uid('mh');
    const head = h(
      'div',
      { class: 'rq-module-head' },
      h('div', null, h('p', { class: 'rq-eyebrow' }, (R.modules.GROUPS.find((g) => g.id === m.group) || {}).label || ''), h('h2', { id: hid, class: 'rq-h2', tabindex: '-1' }, icon(m.icon || 'info', 'rq-icon'), m.title), m.description ? h('p', { class: 'rq-module-desc' }, m.description) : null),
      h('div', { class: 'rq-row rq-row-tight' }, ui.button(R.state.prefs.viewMode === 'table' ? 'Card view' : 'Table view', () => {
        R.state.prefs.viewMode = R.state.prefs.viewMode === 'table' ? 'cards' : 'table';
        renderModule();
      }, { icon: R.state.prefs.viewMode === 'table' ? 'grid' : 'list', cls: 'rq-btn-sm' }), ui.button('Print view', () => window.print(), { icon: 'print', cls: 'rq-btn-sm' }))
    );
    const wrap = h('section', { class: 'rq-module', 'aria-labelledby': hid, 'data-module': m.id }, head);
    if (m.warnings && m.warnings.length) wrap.appendChild(ui.moduleWarnings(m.warnings));
    let body;
    try {
      body = m.render(ctx());
    } catch (e) {
      console.error('[RYLAQ] module render failed:', m.id);
      body = ui.warning('This module could not be displayed. Other modules are unaffected.', 'red');
    }
    wrap.appendChild(body);
    contentEl.appendChild(wrap);
    if (focus) {
      const hd = contentEl.querySelector('#' + hid);
      if (hd) hd.focus();
    } else {
      if (focusKey) {
        const el = [...contentEl.querySelectorAll('[data-focus-key]')].find((x) => x.dataset.focusKey === focusKey);
        if (el) {
          el.focus({ preventScroll: true });
          if (caret !== null && el.setSelectionRange) el.setSelectionRange(caret, caret);
        }
      }
      window.scrollTo(0, scrollY);
    }
  }
  shell.refresh = () => renderModule(false);

  // Modules flagged liveRefresh re-render as lookups finish, unless the user
  // is interacting inside the module (then refresh on focus-out).
  let refreshTimer = null;
  let refreshPending = false;
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      const ae = document.activeElement;
      if (ae && ae !== contentEl && contentEl.contains(ae) && !ae.dataset.focusKey) {
        refreshPending = true;
        return;
      }
      refreshPending = false;
      renderModule(false);
    }, 300);
  }
  shell.scheduleRefresh = scheduleRefresh;

  /* ------------------------------ search ------------------------------ */
  shell.focusSearch = () => {
    searchInput.focus();
    searchInput.select();
  };
  shell.search = async function (value, forcedType) {
    const check = R.privacy.checkInput(value);
    if (!check.ok) {
      // Rejected input is neither stored nor logged; the field is cleared.
      clear(detectEl);
      detectEl.appendChild(ui.warning(check.reason, 'red', 'Input not accepted.'));
      announce(check.reason);
      searchInput.value = '';
      return;
    }
    const res = R.pipeline.run(check.value, forcedType); // session is created synchronously
    renderDetection();
    const s = R.state.session;
    if (!s) return;
    const route = (s.chosen.domain === 'cyber' && 'cyber') || R.pipeline.ROUTE[s.chosen.type] || 'overview';
    shell.go(route);
    await res;
  };

  shell.clearSession = function () {
    R.state.reset();
    searchInput.value = '';
    clear(detectEl);
    applyTheme();
    shell.go('overview');
    announce('Session cleared. All in-memory searches, results, watchlist items, keys and preferences were wiped.');
  };

  /* ---------------------------- status bar ---------------------------- */
  function renderStatus() {
    if (!statusEl) return;
    clear(statusEl);
    const t = R.runtime.totals();
    const tasks = R.tasks.all();
    const loading = tasks.filter((x) => x.status === 'loading').length;
    const failed = tasks.filter((x) => x.status === 'error').length;
    const live = R.sources.list.filter((s) => R.runtime.mode(s.id) === 'live').length;
    const unavailable = R.sources.list.filter((s) => R.runtime.get(s.id).mode === 'unavailable').length;
    R.util.append(statusEl, [
      h('span', { class: 'rq-status-item' }, icon('gauge', 'rq-icon-xs'), `${live} live source(s)` + (unavailable ? `, ${unavailable} unavailable this session` : '')),
      h('span', { class: 'rq-status-item' }, 'Last fetch: ' + (t.last ? fmt.time(t.last) : '—')),
      h('span', { class: 'rq-status-item' }, `OK ${t.ok} · Failed ${t.fail}` + (t.rateLimited ? ` · Rate-limited ${t.rateLimited}` : '')),
      loading ? h('span', { class: 'rq-status-item' }, ui.badge(loading + ' loading', 'org')) : null,
      failed ? h('span', { class: 'rq-status-item' }, ui.badge('Partial results', 'warn'), ' Some results could not be loaded. Other sources are still shown.') : null,
      h(
        'span',
        { class: 'rq-status-actions' },
        failed ? ui.button('Retry failed', () => R.tasks.retryFailed(), { icon: 'refresh', cls: 'rq-btn-xs' }) : null,
        ui.button('Export Session JSON', () => R.exporters.sessionJSON(), { icon: 'download', cls: 'rq-btn-xs' }),
        ui.button('Export Visible CSV', () => R.exporters.visibleCSV(), { icon: 'download', cls: 'rq-btn-xs' }),
        ui.button('Coverage Console', () => shell.go('coverage', { focus: true }), { icon: 'gauge', cls: 'rq-btn-xs' }),
        ui.button('Privacy Info', () => shell.openPrivacy(), { icon: 'lock', cls: 'rq-btn-xs' }),
        ui.button('Clear Session', () => shell.clearSession(), { icon: 'trash', cls: 'rq-btn-xs', variant: 'danger' })
      )
    ]);
  }
  let statusQueued = false;
  function queueStatus() {
    if (statusQueued) return;
    statusQueued = true;
    requestAnimationFrame(() => {
      statusQueued = false;
      renderStatus();
    });
  }

  /* --------------------------- privacy / help --------------------------- */
  function dataFlowSvg() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 640 150');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-labelledby', 'rq-flow-title rq-flow-desc');
    svg.setAttribute('class', 'rq-flow');
    const add = (tag, attrs, text) => {
      const e = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
      if (text) e.textContent = text;
      svg.appendChild(e);
      return e;
    };
    add('title', { id: 'rq-flow-title' }, 'Data flow');
    add('desc', { id: 'rq-flow-desc' }, 'Your browser sends a request directly to a selected public API, which responds directly to your browser. There is no RYLAQ server in the middle.');
    const box = (x, label, sub) => {
      add('rect', { x, y: 30, width: 170, height: 70, rx: 12, fill: 'var(--rq-surface-2)', stroke: 'var(--rq-border-strong)' });
      add('text', { x: x + 85, y: 62, 'text-anchor': 'middle', fill: 'var(--rq-text)', 'font-size': 15, 'font-weight': 600 }, label);
      add('text', { x: x + 85, y: 84, 'text-anchor': 'middle', fill: 'var(--rq-muted)', 'font-size': 12 }, sub);
    };
    box(10, 'Your browser', 'query stays in memory');
    box(460, 'Selected public API', 'e.g. GLEIF, USGS');
    add('line', { x1: 185, y1: 55, x2: 450, y2: 55, stroke: 'var(--rq-teal)', 'stroke-width': 3 });
    add('polygon', { points: '450,49 460,55 450,61', fill: 'var(--rq-teal)' });
    add('line', { x1: 455, y1: 78, x2: 190, y2: 78, stroke: 'var(--rq-navy-ink)', 'stroke-width': 3 });
    add('polygon', { points: '190,72 180,78 190,84', fill: 'var(--rq-navy-ink)' });
    add('text', { x: 320, y: 46, 'text-anchor': 'middle', fill: 'var(--rq-muted)', 'font-size': 12 }, 'request (HTTPS, no cookies)');
    add('text', { x: 320, y: 98, 'text-anchor': 'middle', fill: 'var(--rq-muted)', 'font-size': 12 }, 'public response');
    add('text', { x: 320, y: 132, 'text-anchor': 'middle', fill: 'var(--rq-text)', 'font-size': 13, 'font-weight': 600 }, 'No RYLAQ server in the middle');
    return svg;
  }
  shell.dataFlowSvg = dataFlowSvg;

  shell.privacyContent = function () {
    const providers = R.sources.list.filter((s) => s.kind === 'api');
    return h(
      'div',
      { class: 'rq-prose' },
      h('p', { class: 'rq-lead' }, R.legal.privacyStatement),
      dataFlowSvg(),
      h('ul', null,
        h('li', null, 'RYLAQ does not collect search terms. No account is required.'),
        h('li', null, 'Nothing is saved after refresh: no cookies, no browser storage, no service workers, no analytics, no tracking pixels, no RYLAQ server logs of searches.'),
        h('li', null, 'Searches go directly from your browser to selected public providers. Each provider may log requests according to its own policy.'),
        h('li', null, 'Link-out sources are opened directly by your browser in a new tab, with no referrer.'),
        h('li', null, 'Search terms are never placed in the page URL, so the hosting provider’s access logs do not contain them. The hosting provider may keep standard access logs (IP address, user agent, requested static file, time, status).'),
        h('li', null, 'RYLAQ does not scrape paid, confidential, login-protected, or subscription sources, and does not reproduce paid rating agency reports, paid market reports, paid credit reports, paid ESG ratings, or paywalled news.'),
        h('li', null, 'RYLAQ is not a system of record, not a sanctions clearance tool, not a credit rating agency, not an insurance broker, underwriter, actuary, claims adjuster, or coverage interpreter, not a procurement advisor, bid manager, contract evaluator, or award authority, and not a real-time supply chain control tower.')
      ),
      ui.warning(R.legal.commercialWarning, 'red', 'Commercial confidentiality.'),
      ui.warning(R.legal.sensitiveWarning, 'amber', 'Personal, financial and health data.'),
      h('h3', { class: 'rq-h3' }, 'Providers this browser may contact'),
      h('ul', { class: 'rq-provider-list' }, ...providers.map((s) => h('li', null, h('strong', null, s.displayName), ' — ', ui.modeBadge(s.id), ' ', h('span', { class: 'rq-muted' }, s.attribution)))),
      h('h3', { class: 'rq-h3' }, 'Legal notice'),
      h('p', null, R.legal.privacyLegalSentence),
      h('p', null, R.legal.copyright)
    );
  };
  shell.openPrivacy = () => shell.openDialog('RYLAQ Privacy', shell.privacyContent(), 'modal');
  shell.openLegal = () => shell.openDialog('Legal disclaimer', h('div', { class: 'rq-prose' }, h('ul', null, ...R.legal.longDisclaimer.map((l) => h('li', null, l))), h('p', null, R.legal.trademarkNotice)), 'modal');

  shell.helpContent = function (compact) {
    return h(
      'div',
      { class: 'rq-prose' },
      h('p', { class: 'rq-lead' }, 'RYLAQ is a public-source triage workspace. It organizes public evidence about organizations, insurers and reinsurers, countries, ports, products, vulnerabilities, tenders, awards, grants, PPPs, regulations and risk concepts — and shows exactly where evidence is missing.'),
      h('div', { class: 'rq-help-grid' },
        h('div', null, h('h3', { class: 'rq-h4' }, 'How it works'), h('ul', null,
          h('li', null, 'Searches are not stored by RYLAQ. Results come live from selected public providers verified for browser access.'),
          h('li', null, 'Other sources are link-out only and open in a new tab.'),
          h('li', null, 'Coverage is not global or complete. No hit ≠ clear.'),
          h('li', null, 'Deadlines, timezones and translations must be verified on official portals.'))),
        h('div', null, h('h3', { class: 'rq-h4' }, 'What it is not'), h('ul', null,
          h('li', null, 'Not insurance, underwriting, claims or coverage advice.'),
          h('li', null, 'Not procurement bid/no-bid advice or award decision support.'),
          h('li', null, 'Not sanctions clearance, a credit rating, investment or treasury advice.'),
          h('li', null, 'Not a system of record. It does not scrape paid or confidential sources.'))),
        h('div', null, h('h3', { class: 'rq-h4' }, 'How to use it'), h('ul', null,
          h('li', null, 'Type a query and press Investigate (press / to focus search).'),
          h('li', null, 'Check the interpretation banner — correct it if it is wrong.'),
          h('li', null, 'Open modules from the left rail; deeper sources load on demand.'),
          h('li', null, 'Pin records to the Evidence Board and export an evidence pack (JSON/CSV).'),
          h('li', null, 'Press Clear Session to wipe everything immediately.')))
      ),
      compact ? null : ui.warning(R.legal.commercialWarning, 'red', 'Do not enter confidential data.'),
      compact ? null : h('p', { class: 'rq-fineprint' }, 'Keyboard: / search · Ctrl/⌘+K commands · Esc close dialogs · ↑/↓ move through the module rail.')
    );
  };
  shell.openHelp = () => shell.openDialog('Using the RYLAQ Workspace', shell.helpContent(false), 'modal');

  /* -------------------------- command palette -------------------------- */
  shell.openPalette = function () {
    const cmds = [
      ...R.modules.all().map((m) => ({ label: 'Go to ' + m.title, run: () => shell.go(m.id, { focus: true }) })),
      { label: 'Focus search', run: () => shell.focusSearch() },
      { label: 'Clear session', run: () => shell.clearSession() },
      { label: 'Export current view (CSV)', run: () => R.exporters.visibleCSV() },
      { label: 'Export session (JSON)', run: () => R.exporters.sessionJSON() },
      { label: 'Export evidence pack (JSON)', run: () => R.exporters.evidencePackJSON() },
      { label: 'Open privacy', run: () => shell.openPrivacy() },
      { label: 'Open coverage console', run: () => shell.go('coverage', { focus: true }) },
      { label: 'Toggle theme', run: () => { R.state.prefs.theme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; applyTheme(); } },
      { label: 'Toggle table/card view', run: () => { R.state.prefs.viewMode = R.state.prefs.viewMode === 'table' ? 'cards' : 'table'; renderModule(); } },
      { label: 'Run advanced query', run: () => shell.go('advanced', { focus: true }) },
      { label: 'Open insurance regulator directory (IAIS members)', run: () => shell.openExternal('https://www.iaisweb.org/about-the-iais/iais-members/') },
      { label: 'Open procurement portal directory', run: () => shell.go('procurement', { focus: true }) },
      { label: 'Open OFAC sanctions search (link-out)', run: () => shell.openExternal('https://sanctionssearch.ofac.treas.gov/') },
      { label: 'Open SEC EDGAR full-text search (link-out)', run: () => shell.openExternal('https://www.sec.gov/edgar/search/') },
      { label: 'Open CISA KEV catalog (link-out)', run: () => shell.openExternal('https://www.cisa.gov/known-exploited-vulnerabilities-catalog') },
      { label: 'Open USGS earthquake map (link-out)', run: () => shell.openExternal('https://earthquake.usgs.gov/earthquakes/map/') },
      { label: 'Add primary entity to watchlist', run: () => R.state.session && R.state.session.primary && ui.pin(R.state.session.primary) }
    ];
    const input = h('input', { class: 'rq-input rq-palette-input', type: 'text', 'aria-label': 'Type a command', placeholder: 'Type a command, or a query and press Enter to investigate…', maxlength: '140', autocomplete: 'off' });
    const list = h('ul', { class: 'rq-palette-list', role: 'listbox', 'aria-label': 'Commands' });
    let items = [];
    let sel = 0;
    const draw = () => {
      clear(list);
      const q = input.value.toLowerCase().trim();
      items = cmds.filter((c) => !q || c.label.toLowerCase().includes(q)).slice(0, 12);
      if (q && !items.length) items = [{ label: 'Investigate this query', run: () => { searchInput.value = input.value; shell.search(input.value); } }];
      sel = Math.min(sel, items.length - 1);
      items.forEach((c, i) => list.appendChild(h('li', { role: 'option', 'aria-selected': i === sel ? 'true' : 'false', class: 'rq-palette-item' + (i === sel ? ' is-sel' : ''), onclick: () => exec(i) }, c.label)));
    };
    const exec = (i) => {
      const c = items[i];
      shell.closeDialog();
      if (c) c.run();
    };
    input.addEventListener('input', () => {
      sel = 0;
      draw();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        sel = (sel + 1) % Math.max(1, items.length);
        draw();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        sel = (sel - 1 + items.length) % Math.max(1, items.length);
        draw();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        exec(sel);
      }
    });
    draw();
    shell.openDialog('Command palette', h('div', null, input, list, h('p', { class: 'rq-fineprint' }, 'Commands are not recorded. Do not type confidential information.')), 'palette', { focus: '.rq-palette-input' });
  };

  /* -------------------------------- boot -------------------------------- */
  function boot() {
    root = document.getElementById('rylaq-workspace');
    if (!root) return;
    const initialModule = root.getAttribute('data-initial-module') || 'overview';
    clear(root);
    root.classList.add('rylaq-workspace');
    modalLayer = h('div', { class: 'rq-modal-layer' });
    contentEl = h('div', { id: 'rq-content', class: 'rq-content', tabindex: '-1' });
    statusEl = h('div', { class: 'rq-statusbar', role: 'status', 'aria-label': 'Provider and session status' });
    root.append(
      h('a', { class: 'rq-skip', href: '#rq-content' }, 'Skip to workspace'),
      buildHeader(),
      buildSearch(),
      h('div', { class: 'rq-body' }, buildRail(), contentEl),
      statusEl,
      h(
        'footer',
        { class: 'rq-footer' },
        h('p', null, R.legal.shortDisclaimer),
        h('p', null, R.legal.copyright + ' ' + R.legal.trademarkNotice + ' RYLAQ™ is an independent interface and is not affiliated with or endorsed by data providers unless expressly stated.'),
        h('p', { class: 'rq-footer-links' }, h('button', { type: 'button', class: 'rq-link-btn', onclick: () => shell.openLegal() }, 'Legal disclaimer'), ' · ', h('button', { type: 'button', class: 'rq-link-btn', onclick: () => shell.openPrivacy() }, 'Privacy'), ' · ', h('button', { type: 'button', class: 'rq-link-btn', onclick: () => shell.go('coverage', { focus: true }) }, 'Coverage'), ' · ', h('button', { type: 'button', class: 'rq-link-btn', onclick: () => shell.openHelp() }, 'Support & help'))
      ),
      h('div', { id: 'rq-live', class: 'rq-sr', 'aria-live': 'polite', 'aria-atomic': 'true' }),
      modalLayer
    );
    applyTheme();
    shell.go(R.modules.get(initialModule) ? initialModule : 'overview');
    renderStatus();

    R.events.on('net:update', queueStatus);
    R.events.on('task:update', queueStatus);
    const rerender = () => renderModule(false);
    ['session:started', 'primary:changed', 'session:resolved', 'watchlist:update', 'session:cleared'].forEach((ev) => R.events.on(ev, rerender));
    R.events.on('session:started', () => renderRail());
    R.events.on('task:update', (t) => {
      const m = R.modules.get(R.state.currentModule);
      if (m && m.liveRefresh && t.status !== 'loading') scheduleRefresh();
    });
    contentEl.addEventListener('focusout', () => refreshPending && scheduleRefresh());

    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      const typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
      if (e.key === '/' && !typing && !root.classList.contains('rq-has-dialog')) {
        e.preventDefault();
        shell.focusSearch();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        shell.openPalette();
      } else if (e.key === 'Escape' && root.classList.contains('rq-has-dialog')) {
        shell.closeDialog();
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.RYLAQWorkspace);
