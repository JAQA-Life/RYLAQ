/*
 * renderers.js — shared UI building blocks.
 *
 * All rendering uses R.util.h (textContent only), so strings from APIs can
 * never inject markup. Badges always carry visible text (never colour only).
 * Every record card shows provenance (source, retrieval time, category,
 * confidence) and an official link opened with rel="noopener noreferrer".
 */
(function (R) {
  'use strict';
  const { h, icon, extLink, fmt, clear } = R.util;

  const ui = (R.ui = {});

  ui.badge = (text, tone, title) => h('span', { class: 'rq-badge rq-tone-' + (tone || 'neutral'), title: title || null }, text);

  const CONF_TONE = { Exact: 'ok', Likely: 'org', Possible: 'warn', Unresolved: 'neutral', 'Manual review recommended': 'warn', High: 'ok', Medium: 'warn', Low: 'neutral', Manual: 'org' };
  ui.confidence = (c) => (c ? ui.badge('Match: ' + c, CONF_TONE[c] || 'neutral', 'Match confidence. “Possible” is never treated as “Exact”.') : null);

  const MODE_TONE = { live: 'ok', verify: 'warn', linkout: 'neutral', download: 'neutral', unavailable: 'serious', hidden: 'neutral' };
  const MODE_TEXT = { live: 'Live', verify: 'Verify (link-out)', linkout: 'Link-out only', download: 'Download', unavailable: 'Unavailable', hidden: 'Hidden' };
  ui.modeBadge = (id) => {
    const m = R.runtime.mode(id);
    const s = R.sources.get(id);
    const mode = m === 'linkout' && s && s.status === 'verify' ? 'verify' : m;
    return ui.badge(MODE_TEXT[mode] || mode, MODE_TONE[mode] || 'neutral');
  };

  ui.icon = icon;

  ui.warning = (text, tone, title) => {
    const compact = R.state.prefs.warningsCompact;
    return h(
      'div',
      { class: 'rq-warning rq-warn-' + (tone || 'amber') + (compact ? ' is-compact' : ''), role: 'note' },
      icon(tone === 'info' ? 'info' : 'warn', 'rq-icon-sm'),
      h('div', null, title ? h('strong', null, title + ' ') : null, text)
    );
  };

  ui.section = (title, opts, ...children) => {
    const o = opts || {};
    const id = R.util.uid('sec');
    return h(
      'section',
      { class: 'rq-section' + (o.cls ? ' ' + o.cls : ''), 'aria-labelledby': id },
      h('div', { class: 'rq-section-head' }, h('h3', { id, class: 'rq-h3' }, o.icon ? icon(o.icon, 'rq-icon-sm') : null, title), o.actions ? h('div', { class: 'rq-section-actions' }, o.actions) : null),
      o.desc ? h('p', { class: 'rq-section-desc' }, o.desc) : null,
      ...children
    );
  };

  ui.button = (label, onClick, opts) => {
    const o = opts || {};
    return h('button', { type: 'button', class: 'rq-btn' + (o.variant ? ' rq-btn-' + o.variant : '') + (o.cls ? ' ' + o.cls : ''), onclick: onClick, 'aria-label': o.aria || null, disabled: o.disabled || null, title: o.title || null }, o.icon ? icon(o.icon, 'rq-icon-sm') : null, label ? h('span', null, label) : null);
  };

  ui.skeleton = (n) => h('div', { class: 'rq-skeleton-wrap', 'aria-hidden': 'true' }, Array.from({ length: n || 2 }, () => h('div', { class: 'rq-skeleton' }, h('div', { class: 'rq-sk-line w60' }), h('div', { class: 'rq-sk-line w90' }), h('div', { class: 'rq-sk-line w40' }))));

  ui.kv = (fields, limit) => {
    const dl = h('dl', { class: 'rq-kv' });
    (fields || []).slice(0, limit || fields.length).forEach(([k, v]) => {
      dl.appendChild(h('dt', null, k));
      dl.appendChild(h('dd', null, fmt.val(v)));
    });
    return dl;
  };

  /** Long text with an accessible "Read more" toggle. */
  ui.readMore = (text, n) => {
    const t = String(text || '');
    if (t.length <= (n || 240)) return h('p', { class: 'rq-summary' }, t);
    const p = h('p', { class: 'rq-summary' }, fmt.truncate(t, n || 240));
    let open = false;
    const btn = h('button', { type: 'button', class: 'rq-link-btn', 'aria-expanded': 'false' }, 'Read more');
    btn.addEventListener('click', () => {
      open = !open;
      p.textContent = open ? t : fmt.truncate(t, n || 240);
      btn.textContent = open ? 'Show less' : 'Read more';
      btn.setAttribute('aria-expanded', String(open));
    });
    return h('div', null, p, btn);
  };

  ui.provenance = (prov) =>
    h(
      'div',
      { class: 'rq-prov' },
      icon('doc', 'rq-icon-xs'),
      h('span', null, prov.sourceName),
      h('span', { class: 'rq-dot' }, '·'),
      h('span', null, 'retrieved ' + fmt.time(prov.retrievedAt) + ' (this session)'),
      h('span', { class: 'rq-dot' }, '·'),
      h('span', null, prov.category)
    );

  /** Record card. opts: { onSelect(record) label } */
  ui.recordCard = (r, opts) => {
    const o = opts || {};
    const pinned = R.state.watchlist.some((w) => w.uid === r.uid);
    const title = h('h4', { class: 'rq-card-title', title: r.title }, r.title);
    return h(
      'article',
      { class: 'rq-card', 'data-kind': r.kind },
      h('div', { class: 'rq-card-badges' }, ...r.badges.map((b) => ui.badge(b.text, b.tone)), ui.confidence(r.prov.confidence)),
      title,
      r.subtitle ? h('p', { class: 'rq-card-sub' }, r.subtitle) : null,
      r.summary ? ui.readMore(r.summary, 220) : null,
      ui.kv(r.fields.filter((f) => f[1] !== null && f[1] !== undefined && f[1] !== ''), 5),
      h(
        'div',
        { class: 'rq-card-foot' },
        ui.provenance(r.prov),
        h(
          'div',
          { class: 'rq-card-actions' },
          o.onSelect ? ui.button(o.selectLabel || 'Use this entity', () => o.onSelect(r), { variant: 'primary', cls: 'rq-btn-sm' }) : null,
          ui.button('Details', () => R.shell.openDetail(r), { cls: 'rq-btn-sm', icon: 'list' }),
          ui.button(pinned ? 'Pinned' : 'Pin', (e) => {
            ui.pin(r);
            e.currentTarget.querySelector('span').textContent = 'Pinned';
          }, { cls: 'rq-btn-sm', icon: 'pin', aria: 'Pin to evidence board: ' + r.title }),
          r.prov.url ? extLink(r.prov.url, 'Official source', { cls: 'rq-btn rq-btn-sm rq-btn-ghost' }) : null
        )
      )
    );
  };

  ui.pin = (r) => {
    if (!R.state.watchlist.some((w) => w.uid === r.uid)) {
      R.state.watchlist.push(r);
      R.util.announce('Added to evidence board.');
      R.events.emit('watchlist:update');
    }
  };

  /** Accessible table for records. */
  ui.recordTable = (records, cols) => {
    const columns = cols || [
      ['Record', (r) => r.title],
      ['Type', (r) => r.kind],
      ['Key detail', (r) => (r.fields[1] ? `${r.fields[1][0]}: ${fmt.val(r.fields[1][1])}` : '')],
      ['Source', (r) => r.prov.sourceName],
      ['Match', (r) => r.prov.confidence || '—']
    ];
    const table = h(
      'table',
      { class: 'rq-table' },
      h('thead', null, h('tr', null, ...columns.map(([c]) => h('th', { scope: 'col' }, c)), h('th', { scope: 'col' }, 'Links'))),
      h(
        'tbody',
        null,
        ...records.map((r) =>
          h(
            'tr',
            null,
            ...columns.map(([, fn], i) => (i === 0 ? h('th', { scope: 'row' }, h('button', { type: 'button', class: 'rq-link-btn', onclick: () => R.shell.openDetail(r) }, fmt.truncate(fn(r), 90))) : h('td', null, fmt.truncate(fmt.val(fn(r)), 120)))),
            h('td', null, r.prov.url ? extLink(r.prov.url, 'Source') : '—')
          )
        )
      )
    );
    return h('div', { class: 'rq-table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Results table' }, table);
  };

  ui.records = (records, opts) => {
    if (R.state.prefs.viewMode === 'table' && !(opts && opts.forceCards)) return ui.recordTable(records);
    return h('div', { class: 'rq-cards' }, ...records.map((r) => ui.recordCard(r, opts)));
  };

  /* ------------------------------ task panel ------------------------------ */
  const mounted = new Map(); // key -> Set<{el, render}>
  R.events.on('task:update', (t) => {
    const set = mounted.get(t.key);
    if (!set) return;
    for (const m of [...set]) {
      if (!m.el.isConnected) set.delete(m);
      else m.render();
    }
  });
  R.events.on('net:update', () => {
    for (const set of mounted.values()) for (const m of [...set]) if (!m.el.isConnected) set.delete(m);
  });

  /**
   * Render a live lookup with all states: idle (user-triggered), loading,
   * results, empty (with no-hit ≠ clear warning), error (friendly + link-out),
   * link-out only.
   * opts: { auto, noHitWarning, linkout: {href,label}, onSelect, selectLabel, limit, emptyText, compact }
   */
  ui.taskPanel = (def, opts) => {
    const o = opts || {};
    const t = R.tasks.ensure(def);
    if (t && R.shell) R.shell.visibleTaskKeys.add(def.key);
    const el = h('div', { class: 'rq-task', 'aria-live': 'polite', 'aria-busy': 'false' });
    if (!t) {
      el.appendChild(ui.warning('Start a search to load this evidence.', 'info'));
      return el;
    }
    const src = R.sources.get(def.sourceId);
    const render = () => {
      const task = R.tasks.get(def.key) || t;
      clear(el);
      el.setAttribute('aria-busy', task.status === 'loading' ? 'true' : 'false');
      const head = h(
        'div',
        { class: 'rq-task-head' },
        h('span', { class: 'rq-task-label' }, def.label),
        ui.modeBadge(def.sourceId),
        task.status === 'done' ? ui.badge(task.records.length + (task.meta && task.meta.total > task.records.length ? ' of ' + fmt.num(task.meta.total, 0) : '') + ' record(s)', 'neutral') : null
      );
      el.appendChild(head);
      const linkout = o.linkout || (src ? { href: src.linkoutSearchUrlTemplate && !/\{/.test(src.linkoutSearchUrlTemplate) ? src.linkoutSearchUrlTemplate : src.officialSiteUrl, label: 'Open ' + src.displayName } : null);
      if (task.status === 'idle') {
        if (o.auto) {
          R.tasks.start(def.key);
          el.appendChild(ui.skeleton(1));
        } else if (!R.runtime.isLive(def.sourceId)) {
          task.status = 'linkout';
          render();
        } else {
          el.appendChild(h('div', { class: 'rq-task-idle' }, h('p', { class: 'rq-muted' }, 'Not loaded automatically (keeps request volume low). Loading sends your current query directly from your browser to ' + (src ? src.displayName : 'this provider') + '.'), ui.button('Load from ' + (src ? src.displayName : 'source'), () => R.tasks.start(def.key), { variant: 'primary', icon: 'download' })));
        }
      } else if (task.status === 'loading') {
        el.appendChild(ui.skeleton(o.compact ? 1 : 2));
      } else if (task.status === 'done') {
        const recs = task.records.slice(0, o.limit || 50);
        if (o.render) el.appendChild(o.render(recs, task));
        else el.appendChild(ui.records(recs, { onSelect: o.onSelect, selectLabel: o.selectLabel }));
        if (task.meta && task.meta.note) el.appendChild(ui.warning(task.meta.note, 'info'));
        if (o.after) el.appendChild(o.after(task));
      } else if (task.status === 'empty') {
        el.appendChild(h('p', { class: 'rq-empty' }, (task.meta && task.meta.note) || o.emptyText || 'This query returned no public records from this source.'));
        if (o.noHitWarning !== false) el.appendChild(ui.warning(R.legal.noHitNotClear, 'amber', 'No match does not mean no risk.'));
        if (linkout && linkout.href) el.appendChild(h('p', null, extLink(linkout.href, linkout.label)));
      } else if (task.status === 'linkout') {
        el.appendChild(h('p', { class: 'rq-muted' }, src && src.status === 'verify' ? 'Live request unavailable from this browser (not verified for this origin). Open the source directly.' : R.net.errorText('linkout')));
        if (linkout && linkout.href) el.appendChild(h('p', null, extLink(linkout.href, linkout.label)));
      } else if (task.status === 'error') {
        const msg = R.net.errorText(task.errorKind);
        el.appendChild(h('p', { class: 'rq-error', role: 'status' }, msg));
        if (task.errorKind === 'rate_limited' && task.retryAt) el.appendChild(h('p', { class: 'rq-muted' }, 'You can retry after ' + fmt.time(new Date(task.retryAt)) + '.'));
        const row = h('div', { class: 'rq-row' });
        if (task.errorKind !== 'cors_or_network') row.appendChild(ui.button('Retry', () => {
          task.status = 'idle';
          R.tasks.start(def.key);
        }, { icon: 'refresh' }));
        if (linkout && linkout.href) row.appendChild(extLink(linkout.href, linkout.label));
        el.appendChild(row);
      }
    };
    render();
    if (!mounted.has(def.key)) mounted.set(def.key, new Set());
    mounted.get(def.key).add({ el, render });
    return el;
  };

  /* ------------------------------ link-outs ------------------------------ */
  /** Render a directory of official link-outs. q is optional. */
  ui.linkouts = (entries, q, opts) => {
    const o = opts || {};
    const list = h('ul', { class: 'rq-linklist' + (o.compact ? ' is-compact' : '') });
    entries.forEach((e) => {
      const lo = R.linkout(e, q);
      list.appendChild(
        h(
          'li',
          null,
          extLink(lo.href, e.name),
          e.region ? h('span', { class: 'rq-link-meta' }, e.region) : null,
          e.kind === 'paid' ? ui.badge('Paid / link-out only', 'neutral') : null,
          e.kind === 'rating-agency' ? ui.badge('Rating agency link-out', 'ins') : null,
          e.kind === 'market-report' ? ui.badge('Market-report link-out', 'ins') : null,
          e.translationRisk || (e.lang && e.lang !== 'en') ? ui.badge('Translation risk', 'warn') : null,
          lo.withQuery ? h('span', { class: 'rq-link-meta', title: 'This link carries your query to the provider.' }, 'opens with your query') : null,
          e.note ? h('span', { class: 'rq-link-note' }, e.note) : null
        )
      );
    });
    return h('div', { class: 'rq-linkouts' }, o.title ? h('h4', { class: 'rq-h4' }, o.title) : null, list, h('p', { class: 'rq-fineprint' }, 'Link-outs are opened directly by your browser in a new tab. RYLAQ does not fetch, scrape or store these pages.'));
  };
  ui.dir = (key, q, opts) => ui.linkouts(R.directories[key] || [], q, opts);

  /* ---------------------------- misc widgets ---------------------------- */
  ui.bars = (rows, opts) => {
    const max = Math.max(1, ...rows.map((r) => r[1]));
    return h(
      'div',
      { class: 'rq-bars', role: 'list', 'aria-label': (opts && opts.label) || 'Distribution' },
      ...rows.map(([label, v, tone]) =>
        h('div', { class: 'rq-bar-row', role: 'listitem' }, h('span', { class: 'rq-bar-label' }, label), h('span', { class: 'rq-bar-track', 'aria-hidden': 'true' }, h('span', { class: 'rq-bar-fill rq-tone-' + (tone || 'org'), style: { width: Math.max(2, (v / max) * 100) + '%' } })), h('span', { class: 'rq-bar-val' }, String(v)))
      )
    );
  };

  ui.emptyModule = (text) =>
    h('div', { class: 'rq-empty-state' }, icon('search', 'rq-icon-lg'), h('p', null, text || 'Start with a company, insurer, reinsurer, broker, country, port, HS code, CVE, tender, award, grant, PPP, regulation, or risk concept.'), ui.button('Focus search', () => R.shell.focusSearch(), { variant: 'primary', icon: 'search' }));

  /** Conflict panel: shows each source side by side; never resolves automatically. */
  ui.conflict = (label, items) =>
    h(
      'div',
      { class: 'rq-conflict', role: 'group', 'aria-label': 'Source discrepancy: ' + label },
      h('div', { class: 'rq-conflict-head' }, ui.badge('Source discrepancy', 'warn'), h('strong', null, label)),
      h('div', { class: 'rq-conflict-grid' }, ...items.map((it) => h('div', { class: 'rq-conflict-cell' }, h('div', { class: 'rq-muted' }, it.source), h('div', null, fmt.val(it.value)), it.url ? extLink(it.url, 'Open ' + it.source) : null))),
      h('p', { class: 'rq-fineprint' }, 'RYLAQ does not adjudicate legal, compliance, credit, sanctions, insurance, reinsurance, procurement, bid, award, claims, coverage, or financial decisions. Verify with each source.')
    );

  ui.moduleWarnings = (list) => h('div', { class: 'rq-module-warnings' }, ...list.map((w) => ui.warning(w, 'amber')));

  /** Filter/select helper. */
  ui.select = (label, options, value, onChange, opts) => {
    const id = R.util.uid('sel');
    const sel = h('select', { id, class: 'rq-input', 'data-focus-key': (opts && opts.key) || label, onchange: (e) => onChange(e.target.value) }, ...options.map(([v, l]) => h('option', { value: v, selected: v === value ? true : null }, l)));
    return h('label', { class: 'rq-field' + (opts && opts.cls ? ' ' + opts.cls : ''), for: id }, h('span', null, label), sel);
  };
  ui.input = (label, value, onInput, opts) => {
    const o = opts || {};
    const id = R.util.uid('in');
    const inp = h('input', { id, class: 'rq-input', 'data-focus-key': o.key || label, type: o.type || 'text', value: value || '', placeholder: o.placeholder || '', maxlength: o.maxlength || 120, autocomplete: 'off', spellcheck: 'false', oninput: (e) => onInput(e.target.value) });
    return h('label', { class: 'rq-field' + (o.cls ? ' ' + o.cls : ''), for: id }, h('span', null, label), inp);
  };

  /** Module export bar (JSON + CSV of the records visible in the module). */
  ui.exportBar = (jsonName, csvName, domain) =>
    h(
      'div',
      { class: 'rq-row rq-export-bar' },
      ui.button('Export JSON', () => R.exporters.visibleJSON(jsonName, domain), { icon: 'download', cls: 'rq-btn-sm' }),
      ui.button('Export CSV', () => {
        const keys = [...R.shell.visibleTaskKeys];
        const recs = keys.map((k) => R.tasks.get(k)).filter(Boolean).flatMap((t) => t.records || []);
        if (!recs.length) return R.util.announce('No records loaded in this module yet.');
        R.exporters.csv(csvName, recs, domain);
      }, { icon: 'download', cls: 'rq-btn-sm' })
    );

  /** Standard "context required" block when a module needs a session. */
  ui.needSession = (what) => ui.emptyModule(what ? `Run a search to populate ${what}.` : null);
})(window.RYLAQWorkspace);
