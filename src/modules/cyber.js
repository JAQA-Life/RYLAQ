/*
 * cyber.js — MODULE 13: Cyber, Technology, AI & Software Supply-Chain Risk.
 *
 * Uses CISA KEV (official cisagov mirror) and NVD. No scanning of any kind:
 * Shodan/Censys/VirusTotal/urlscan are link-out only and never called.
 * A vulnerability record is never presented as confirmed supplier exposure.
 */
(function (R) {
  'use strict';
  const { h, extLink } = R.util;
  const ui = R.ui;
  const T = R.T;

  T.kevRecent = () => ({ key: 'kev:recent', sourceId: 'cisaKev', label: 'CISA KEV — most recent additions', run: () => R.clients.kev.recent(15) });

  R.modules.register({
    id: 'cyber',
    group: 'risk',
    order: 10,
    icon: 'bug',
    title: 'Cyber, Technology, AI & Software Supply Chain',
    short: 'Cyber & Software Supply Chain',
    description: 'Known exploited vulnerabilities, CVE records, cyber-incident filing items and official advisories relevant to vendors, platforms and supply chains.',
    warnings: [
      'CVE records do not prove that a supplier, insurer, broker, or procurement platform uses the affected software or firmware version.',
      'Cyber supply-chain triage requires asset inventory, SBOMs where available, vendor attestations, and incident response review. No live scanning; no confidential asset inventory upload.'
    ],
    render(ctx) {
      if (!ctx.session)
        return h('div', null, ui.needSession('cyber evidence'), ui.dir('cyber', null, { title: 'Official cyber sources' }));
      const c = ctx.chosen;
      const name = ctx.primary ? (ctx.primary.data && ctx.primary.data.name) || ctx.primary.title : ctx.q;
      const parts = [];
      if (c.type === 'cve') {
        parts.push(
          ui.section('Known exploitation (CISA KEV)', { icon: 'warn' }, ui.taskPanel(T.kevCve(c.cve), { auto: true, emptyText: 'This CVE is not in the CISA KEV catalog. Absence from KEV does not mean it is not exploited.', noHitWarning: false })),
          ui.section('CVE record (NVD)', { icon: 'doc' }, ui.taskPanel(T.nvdCve(c.cve), { auto: true })),
          h('div', { class: 'rq-row' }, extLink('https://www.cve.org/CVERecord?id=' + c.cve, 'CVE.org record'), extLink('https://nvd.nist.gov/vuln/detail/' + c.cve, 'NVD record'), extLink('https://github.com/advisories?query=' + encodeURIComponent(c.cve), 'GitHub Advisory Database'))
        );
      } else if (c.type === 'cwe') {
        parts.push(ui.section('Weakness reference', { icon: 'doc' }, extLink('https://cwe.mitre.org/data/definitions/' + c.cwe + '.html', 'MITRE CWE-' + c.cwe), h('p', { class: 'rq-muted' }, 'CWE is a weakness taxonomy; it does not identify affected products.')));
      } else if (R.pipeline.ORG_TYPES.includes(c.type) || ctx.primary || c.type === 'freetext' || c.type === 'category') {
        const term = name.split(/\s+/)[0];
        parts.push(
          ui.section('Vendor/product mentions in CISA KEV', { icon: 'warn', desc: `Matches the text “${term}” against KEV vendor/product fields. A match is about a product, not about any organization’s deployment.` }, ui.taskPanel(T.kevMentions(term), { limit: 10, emptyText: 'No KEV entries mention this vendor/product text.' })),
          ui.section('NVD keyword search', { icon: 'search' }, ui.taskPanel(T.nvdKeyword(name), { limit: 10 }))
        );
      } else {
        parts.push(ui.section('Recent CISA KEV additions', { icon: 'warn', desc: 'Downloads the KEV catalog once per session (user-triggered).' }, ui.taskPanel(T.kevRecent(), { limit: 15, auto: c.domain === 'cyber' })));
      }
      if (ctx.resolved.cik) parts.push(ui.section('Cybersecurity incident disclosures (SEC 8-K item 1.05)', { icon: 'doc' }, ui.taskPanel(T.secSubs(ctx.resolved.cik), { auto: true, render: R.secSignalsView })));
      parts.push(
        ui.section('Advisories & software supply-chain references', { icon: 'link' }, ui.dir('cyber', null, { compact: true })),
        ui.section('Scanners & exposure search engines (link-out only)', { icon: 'shield', desc: 'RYLAQ never scans, probes, fingerprints or enumerates any system. Use these only under your organization’s authorization and policies.' }, ui.dir('scannersLinkOutOnly', null, { compact: true })),
        ui.exportBar('RYLAQ-Cyber-results.json', 'RYLAQ-Cyber-results.csv', 'globalRisk')
      );
      return h('div', null, ...parts);
    }
  });
})(window.RYLAQWorkspace);
