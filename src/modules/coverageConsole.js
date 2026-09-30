/*
 * coverageConsole.js — MODULE 28: Coverage Console.
 *
 * Transparent, in-memory view of every source: tier, default mode, runtime
 * mode, CORS verification, counters and policy flags. Availability checks
 * are user-triggered only (never on page load), sequential, and use fixed
 * probe URLs that contain no user data.
 */
(function (R) {
  'use strict';
  const { h, fmt, extLink } = R.util;
  const ui = R.ui;

  const FLAGS = [
    ['mayLagOfficialDb', 'May lag official DB'], ['publicDataOnly', 'Public data only'], ['controlledAccessProhibited', 'Controlled access prohibited'], ['paidSourceLinkOutOnly', 'Paid source: link-out only'],
    ['regulatorLinkOutOnly', 'Regulator link-out only'], ['ratingAgencyLinkOutOnly', 'Rating-agency link-out only'], ['marketReportLinkOutOnly', 'Market-report link-out only'], ['procurementPortalLinkOutOnly', 'Procurement-portal link-out only'],
    ['insolvencyRegistryLinkOutOnly', 'Insolvency-registry link-out only'], ['lienRegistryLinkOutOnly', 'Lien-registry link-out only'], ['sanctionsLinkOutOnly', 'Sanctions link-out only'], ['guidelineLinkOutOnly', 'Guideline link-out only'],
    ['translationRisk', 'Translation risk'], ['deadlineRisk', 'Deadline risk'], ['officialSourceAuthoritative', 'Official source authoritative'], ['falseNegativeRisk', 'False-negative risk'], ['legalReviewRequired', 'Legal review required']
  ];

  let checking = false;
  async function checkAll() {
    if (checking) return;
    checking = true;
    R.shell.refresh();
    const ids = R.sources.list.filter((s) => s.probe).map((s) => s.id);
    // Sequential, max one in flight: polite to providers.
    for (const id of ids) {
      await R.probeSource(id);
      R.shell.refresh();
    }
    checking = false;
    R.shell.refresh();
    R.util.announce('Availability check complete.');
  }

  R.modules.register({
    id: 'coverage',
    group: 'evidence',
    order: 54,
    icon: 'gauge',
    title: 'Coverage Console',
    short: 'Coverage Console',
    description: 'Every source RYLAQ knows about: live, verify, link-out or unavailable — with verification notes, counters, rate-limit events and policy flags.',
    warnings: ['Console data remains in memory only and is not sent anywhere. Availability checks run only when you click them.'],
    render() {
      const cfg = R.config.corsVerification || {};
      const devOpen = { v: false };
      const rows = R.sources.list.map((s) => {
        const rt = R.runtime.get(s.id);
        const mode = R.runtime.mode(s.id);
        return h(
          'tr',
          null,
          h('th', { scope: 'row' }, h('div', null, s.displayName), h('div', { class: 'rq-muted' }, s.region + ' · Tier ' + s.tier)),
          h('td', null, ui.modeBadge(s.id), h('div', { class: 'rq-muted' }, 'Default: ' + s.defaultMode + (s.status === 'verify' ? ' (verify)' : ''))),
          h('td', null, s.corsVerified ? ui.badge('CORS verified', 'ok') : s.liveCapable ? ui.badge('Not verified', 'warn') : ui.badge('N/A (link-out)', 'neutral'), rt.sessionVerified ? ui.badge('Confirmed this session', 'ok') : null),
          h('td', null, `OK ${rt.ok} · Fail ${rt.fail} · 429 ${rt.rateLimited} · Skipped ${rt.skipped}`, h('div', { class: 'rq-muted' }, 'Last: ' + (rt.lastStatus || '—') + (rt.lastFetch ? ' at ' + fmt.time(rt.lastFetch) : ''))),
          h('td', { class: 'rq-flags' }, ...FLAGS.filter(([k]) => s[k]).map(([, l]) => ui.badge(l, 'neutral'))),
          h('td', null, h('div', { class: 'rq-fineprint' }, s.lastVerifiedNote), s.coverageGapWarning ? h('div', { class: 'rq-fineprint rq-gap-cell' }, s.coverageGapWarning) : null, rt.reason ? h('div', { class: 'rq-fineprint' }, rt.reason) : null),
          h('td', null, s.probe ? ui.button('Check availability', async () => {
            await R.probeSource(s.id);
            R.shell.refresh();
          }, { cls: 'rq-btn-xs', disabled: checking }) : null, s.officialSiteUrl ? extLink(s.officialSiteUrl, 'Official site') : null, s.officialDocsUrl ? extLink(s.officialDocsUrl, 'Docs') : null)
        );
      });
      const counts = { live: 0, verify: 0, linkout: 0, unavailable: 0 };
      R.sources.list.forEach((s) => {
        const m = R.runtime.mode(s.id);
        const k = m === 'linkout' && s.status === 'verify' ? 'verify' : m;
        counts[k] = (counts[k] || 0) + 1;
      });
      const tasks = R.tasks.all();
      return h(
        'div',
        null,
        h('div', { class: 'rq-two-col' },
          ui.section('Source modes (this session)', { icon: 'chart' }, ui.bars([['Live', counts.live, 'ok'], ['Verify (link-out until verified)', counts.verify || 0, 'warn'], ['Link-out only', counts.linkout, 'neutral'], ['Unavailable', counts.unavailable || 0, 'serious']], { label: 'Source modes' })),
          ui.section('Build-time verification', { icon: 'check' }, ui.kv([['Origin tested', cfg.origin || 'Not verified'], ['Verified at', cfg.verifiedAt || '—'], ['Runner', cfg.runner || '—'], ['Method', cfg.method || '—']]), h('p', { class: 'rq-fineprint' }, 'Only verified hosts are allowed by the production Content-Security-Policy. Re-run scripts/verify-cors.mjs to promote a source.'))
        ),
        h('div', { class: 'rq-row' }, ui.button(checking ? 'Checking…' : 'Check availability of all live-capable sources', () => checkAll(), { icon: 'refresh', variant: 'primary', disabled: checking }), ui.button('Retry failed requests', () => R.tasks.retryFailed(), { icon: 'refresh' }), ui.button('Copy session JSON', () => {
          const payload = Object.assign(R.legal.exportBlock([]), { coverage: R.sources.list.map((s) => ({ id: s.id, mode: R.runtime.mode(s.id), stats: Object.assign({}, R.runtime.get(s.id), { rateLimitedUntil: undefined }) })) });
          navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(() => R.util.announce('Coverage JSON copied.'), () => R.util.announce('Copy failed.'));
        }, { icon: 'copy' }), ui.button('Export visible results', () => R.exporters.visibleCSV(), { icon: 'download' })),
        h('div', { class: 'rq-table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Source capability registry' }, h('table', { class: 'rq-table rq-console' }, h('thead', null, h('tr', null, ...['Source', 'Mode', 'CORS', 'Counters', 'Flags', 'Notes', 'Actions'].map((c) => h('th', { scope: 'col' }, c)))), h('tbody', null, ...rows))),
        h('details', { class: 'rq-tech' }, h('summary', null, 'Developer panel (technical, no payloads)'), h('pre', { class: 'rq-pre' }, JSON.stringify({ queue: R.net.stats(), tasks: tasks.map((t) => ({ source: t.sourceId, status: t.status, errorKind: t.errorKind || undefined, records: (t.records || []).length })) }, null, 2))),
        ui.section('Third-party projects & platforms (reference / link-out only)', { icon: 'link', desc: 'Not integrated. No iframes, no runtime code, no API calls. No affiliation; nothing here is a clearance or authoritative determination.' }, h('ul', { class: 'rq-linklist' }, ...R.directories.thirdPartyRepos.map((e) => h('li', null, extLink(e.url, e.name), ui.badge(e.mode, 'neutral'), h('span', { class: 'rq-link-meta' }, 'Licence: ' + e.license), h('span', { class: 'rq-link-note' }, e.note))))),
        ui.section('Paid / commercial providers (link-out only)', { icon: 'coin' }, ui.dir('paid', null, { compact: true })),
        ui.section('Internal systems', { icon: 'lock' }, h('p', null, 'ERP, vendor master, spend cube, contracts, purchase orders, invoices, questionnaires, credit bureau reports, internal risk scores, audit findings, bid documents, underwriting and claims files, policy administration, treasury, hedging, payments and KYC repositories are unavailable by design. RYLAQ never accepts internal data.'))
      );
    }
  });
})(window.RYLAQWorkspace);
