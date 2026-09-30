/*
 * watchlist.js — MODULE 26: Watchlist / Evidence Board.
 *
 * Holds only records derived from public sources (pinned from result cards).
 * There is deliberately no free-text notes field. Memory only: refresh or
 * Clear Session empties it.
 */
(function (R) {
  'use strict';
  const { h } = R.util;
  const ui = R.ui;

  R.modules.register({
    id: 'watchlist',
    group: 'evidence',
    order: 52,
    icon: 'pin',
    title: 'Watchlist / Evidence Board',
    short: 'Evidence Board',
    description: 'A temporary, in-memory board of pinned public-source records, exportable as an evidence pack with provenance and legal metadata.',
    warnings: ['The watchlist is temporary and is not stored by JAQA. Do not add confidential bid, pricing, underwriting, claims, contract, personal, health, bank, payment, internal risk rating, or protected commercial information.'],
    render() {
      const list = R.state.watchlist;
      const bySource = {};
      list.forEach((r) => (bySource[r.prov.sourceName] = (bySource[r.prov.sourceName] || 0) + 1));
      return h(
        'div',
        null,
        h(
          'div',
          { class: 'rq-row' },
          ui.button('Export evidence pack (JSON)', () => R.exporters.evidencePackJSON(), { icon: 'download', variant: 'primary', cls: 'rq-btn-sm' }),
          ui.button('Export evidence pack (CSV)', () => R.exporters.evidencePackCSV(), { icon: 'download', cls: 'rq-btn-sm' }),
          ui.button('Export watchlist (JSON)', () => R.exporters.watchlistJSON(), { icon: 'download', cls: 'rq-btn-sm' }),
          ui.button('Copy official source links', () => R.exporters.copyLinks(), { icon: 'copy', cls: 'rq-btn-sm' }),
          ui.button('Copy LEI list', () => R.exporters.copyIds('lei', 'LEI list'), { icon: 'copy', cls: 'rq-btn-sm' }),
          ui.button('Copy ticker list', () => R.exporters.copyIds('ticker', 'Ticker list'), { icon: 'copy', cls: 'rq-btn-sm' }),
          ui.button('Copy CIK list', () => R.exporters.copyIds('cik', 'CIK list'), { icon: 'copy', cls: 'rq-btn-sm' }),
          ui.button('Copy CVE list', () => R.exporters.copyIds('cve', 'CVE list'), { icon: 'copy', cls: 'rq-btn-sm' }),
          ui.button('Copy award ID list', () => R.exporters.copyIds('award', 'Award ID list'), { icon: 'copy', cls: 'rq-btn-sm' }),
          ui.button('Copy recall ID list', () => R.exporters.copyIds('recall', 'Recall ID list'), { icon: 'copy', cls: 'rq-btn-sm' }),
          ui.button('Copy regulatory document numbers', () => R.exporters.copyIds('frDoc', 'Regulatory document number list'), { icon: 'copy', cls: 'rq-btn-sm' }),
          list.length ? ui.button('Clear board', () => {
            R.state.watchlist = [];
            R.events.emit('watchlist:update');
          }, { icon: 'trash', variant: 'danger', cls: 'rq-btn-sm' }) : null
        ),
        list.length
          ? h('div', null, ui.bars(Object.entries(bySource).map(([k, v]) => [k, v, 'org']), { label: 'Pinned records by source' }), h('div', { class: 'rq-cards' }, ...list.map((r) => h('div', { class: 'rq-pin-wrap' }, ui.recordCard(r), ui.button('Remove', () => {
              R.state.watchlist = R.state.watchlist.filter((x) => x.uid !== r.uid);
              R.events.emit('watchlist:update');
            }, { icon: 'trash', cls: 'rq-btn-xs', aria: 'Remove from board: ' + r.title })))))
          : h('div', { class: 'rq-empty-state' }, R.util.icon('pin', 'rq-icon-lg'), h('p', null, 'No pinned records yet. Use “Pin” on any result card to build an evidence board for this session.'))
      );
    }
  });
})(window.JAQAWorkspace);
