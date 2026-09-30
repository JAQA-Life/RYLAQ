/*
 * sessionPrivacy.js — MODULE 29: Session & Privacy (plus display
 * preferences). Preferences live in memory only and reset on refresh or
 * Clear Session.
 */
(function (R) {
  'use strict';
  const { h, extLink } = R.util;
  const ui = R.ui;

  function toggle(label, checked, onChange) {
    const id = R.util.uid('tg');
    return h('label', { class: 'rq-toggle', for: id }, h('input', { id, type: 'checkbox', checked: checked ? true : null, onchange: (e) => onChange(e.target.checked), 'data-focus-key': label }), h('span', null, label));
  }

  R.modules.register({
    id: 'session',
    group: 'evidence',
    order: 55,
    icon: 'lock',
    title: 'Session & Privacy',
    short: 'Session & Privacy',
    description: 'How RYLAQ handles your data, provider attributions, display preferences, exports and the legal notice.',
    render() {
      const p = R.state.prefs;
      const refresh = () => {
        R.shell.applyTheme();
        R.shell.renderRail();
        R.shell.refresh();
      };
      const s = R.state.session;
      return h(
        'div',
        null,
        ui.section('Your session', { icon: 'lock' }, ui.kv([
          ['Active query', s ? 'Yes — held in memory only (not shown here)' : 'None'],
          ['Lookups in memory', String(R.tasks.all().length)],
          ['Pinned records', String(R.state.watchlist.length)],
          ['API keys in memory', 'None (this release uses no keys)'],
          ['Persistence', 'None. Refresh or Clear Session wipes everything.']
        ]), h('div', { class: 'rq-row' }, ui.button('Clear Session', () => R.shell.clearSession(), { icon: 'trash', variant: 'danger' }), ui.button('Export session JSON', () => R.exporters.sessionJSON(), { icon: 'download' }), ui.button('Export evidence pack JSON', () => R.exporters.evidencePackJSON(), { icon: 'download' }), ui.button('Copy privacy statement', () => R.exporters.copyPrivacy(), { icon: 'copy' }), ui.button('Print current view', () => window.print(), { icon: 'print' }))),
        ui.section('Privacy', { icon: 'shield' }, R.shell.privacyContent()),
        ui.section('Display preferences (memory only)', { icon: 'sliders' },
          h('div', { class: 'rq-filters' },
            ui.select('Theme', [['ops', 'Situation room (HUD)'], ['dark', 'Dark'], ['light', 'Light'], ['system', 'Follow system (light/dark)']], p.theme, (v) => ((p.theme = v), refresh()), { key: 'pref-theme' }),
            ui.select('Density', [['comfortable', 'Comfortable'], ['compact', 'Compact']], p.density, (v) => ((p.density = v), refresh()), { key: 'pref-density' }),
            ui.select('Result view', [['cards', 'Cards'], ['table', 'Table']], p.viewMode, (v) => ((p.viewMode = v), refresh()), { key: 'pref-view' })
          ),
          h('div', { class: 'rq-toggles' },
            toggle('Compact warnings', p.warningsCompact, (v) => ((p.warningsCompact = v), refresh())),
            toggle('Compact market indicators', p.marketCompact, (v) => ((p.marketCompact = v), refresh())),
            toggle('Highlight coverage gaps', p.highlightGaps, (v) => ((p.highlightGaps = v), refresh())),
            toggle('Official-link-only mode (link-outs never carry your query)', p.officialLinkOnly, (v) => ((p.officialLinkOnly = v), refresh())),
            ...R.modules.GROUPS.map((g) => toggle('Show ' + g.label + ' modules', !p.hiddenGroups.has(g.id), (v) => {
              if (v) p.hiddenGroups.delete(g.id);
              else p.hiddenGroups.add(g.id);
              refresh();
            }))
          ),
          h('h4', { class: 'rq-h4' }, 'Source visibility'),
          h('div', { class: 'rq-toggles rq-toggles-grid' }, ...R.sources.list.filter((x) => x.corsVerified).map((x) => toggle(x.displayName, !p.hiddenSources.has(x.id), (v) => {
            if (v) p.hiddenSources.delete(x.id);
            else p.hiddenSources.add(x.id);
            R.events.emit('net:update');
            refresh();
          })))
        ),
        ui.section('Provider attributions', { icon: 'doc' }, h('ul', null, ...R.sources.list.filter((x) => x.attribution).map((x) => h('li', null, x.attribution, x.officialSiteUrl ? [' ', extLink(x.officialSiteUrl, 'site')] : null)))),
        ui.section('Legal notice', { icon: 'gavel' }, h('ul', null, ...R.legal.longDisclaimer.map((l) => h('li', null, l))), h('p', null, R.legal.trademarkNotice))
      );
    }
  });
})(window.RYLAQWorkspace);
