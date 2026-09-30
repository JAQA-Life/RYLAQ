/*
 * insuranceReinsurance.js — MODULE 11: Insurance & Reinsurance Intelligence,
 * MODULE 12: Insurance & Reinsurance Financial Strength.
 *
 * HOW INSURANCE SOURCES ARE LINK-OUT-FIRST
 *   Insurance regulators, rating agencies, market reports, Lloyd’s, captive
 *   and ILS resources have no verified public browser APIs. They are official
 *   link-outs only. Rating reports and market reports are never scraped,
 *   reproduced or derived. Live evidence comes only from verified sources
 *   (GLEIF, SEC, Federal Register, USGS, USAspending, CourtListener).
 *
 * HOW NO INSURANCE ADVICE IS GENERATED
 *   Outputs are records and links. No coverage, capacity, solvency,
 *   recoverability, broker-suitability or premium statement is ever rendered.
 */
(function (R) {
  'use strict';
  const { h, extLink } = R.util;
  const ui = R.ui;
  const T = R.T;

  const INS_WARN = 'JAQA does not provide insurance, reinsurance, underwriting, claims, coverage, broker-selection, or capacity advice. Insurance and reinsurance decisions require qualified brokers, insurers, reinsurers, actuaries, legal counsel, regulators, and risk professionals as appropriate.';
  const RE_WARN = 'Reinsurance capacity, treaty terms, recoverables, retrocession chains, and collateral arrangements are often confidential. JAQA only organizes public-source signals and official link-outs.';
  const ILS_WARN = 'Catastrophe bonds and insurance-linked securities involve complex legal, credit, market, and trigger risks. Public records do not constitute investment advice or risk transfer confirmation.';
  const NOHIT = 'No public record found does not mean an insurer, reinsurer, broker, captive, or ILS vehicle is clear, solvent, authorized, or suitable.';

  const ENTITY_TYPES = ['insurer', 'reinsurer', 'broker', 'mga', 'captive', 'ils', 'tpa', 'syndicate'];

  function linesView(ctx) {
    const matched = ctx.chosen && ctx.chosen.lines ? ctx.chosen.lines : [];
    return h(
      'div',
      { class: 'rq-lines' },
      ...R.taxonomy.insuranceLines.map((l) =>
        h('div', { class: 'rq-line' + (matched.includes(l.id) ? ' is-match' : '') }, h('strong', null, l.name), l.risks.length ? h('div', { class: 'rq-muted' }, 'Related risk domains: ' + l.risks.map((id) => (R.taxonomy.global.find((d) => d.id === id) || {}).name).filter(Boolean).join(', ')) : null, matched.includes(l.id) ? ui.badge('Matches query', 'org') : null)
      )
    );
  }

  function catContext(ctx) {
    const r = ctx.resolved || {};
    if (r.lat && r.lon)
      return h('div', null, h('p', { class: 'rq-muted' }, 'Reference point: ' + (r.placeLabel || 'resolved location') + '. Geographic event context only — not exposure by policy, not insured loss.'), h('div', { class: 'rq-two-col' }, ui.taskPanel(T.quakes(r.lat, r.lon, 500, 30), { compact: true }), ui.taskPanel(T.forecast(r.lat, r.lon, r.placeLabel), { compact: true })));
    return h('p', { class: 'rq-muted' }, 'Search a country, port or place to add catastrophe-event context by geography. Event data does not confirm insured loss or claims liability.');
  }

  R.modules.register({
    id: 'insurance',
    group: 'insurance',
    order: 30,
    icon: 'umbrella',
    title: 'Insurance & Reinsurance Intelligence',
    short: 'Insurance & Reinsurance',
    description: 'Public evidence on insurers, reinsurers, brokers, MGAs, captives, Lloyd’s syndicates, ILS/cat bond vehicles and TPAs — regulators, filings, lines, catastrophe context and insurance-related procurement.',
    warnings: [INS_WARN, 'JAQA does not determine coverage, capacity, solvency, claims outcome, broker suitability, reinsurance recoverability, or insurance market conditions.', NOHIT],
    render(ctx) {
      const isEntity = ctx.session && ENTITY_TYPES.includes(ctx.type);
      const name = ctx.primary ? (ctx.primary.data && ctx.primary.data.name) || ctx.primary.title : ctx.q;
      const q = ctx.session ? ctx.q : '';
      return h(
        'div',
        null,
        ui.section('1. Counterparty overview', { icon: 'building' }, ctx.session ? (isEntity || ctx.primary ? (ctx.primary ? h('div', null, ui.recordCard(ctx.primary), ui.button('Open Organization 360', () => R.shell.go('org360', { focus: true }), { cls: 'rq-btn-sm' })) : R.entityGate(ctx, 'insurance counterparty evidence')) : h('p', { class: 'rq-muted' }, 'The current query is not an insurance entity. Search an insurer, reinsurer, broker, MGA, captive, syndicate, ILS vehicle or TPA to resolve a counterparty.')) : ui.needSession('insurance counterparty evidence')),
        ui.section('2. Regulatory coverage (official registers, link-out)', { icon: 'gavel', desc: 'Authorization and licensing status is authoritative only in the regulator’s own register.' }, ui.dir('insuranceRegulators', null, { compact: true })),
        ui.section('3. Financial strength & credit signals', { icon: 'chart' }, h('p', null, 'See the Financial Strength lens for filings, regulator returns and rating link-outs.'), ui.button('Open Insurance & Reinsurance Financial Strength', () => R.shell.go('insuranceStrength', { focus: true }), { cls: 'rq-btn-sm' })),
        ui.section('4. Insurance lines & product context', { icon: 'layers', desc: 'Context for discussion with qualified professionals. Not a coverage determination.' }, linesView(ctx)),
        ui.section('5. Catastrophe / event exposure context (by geography, not by policy)', { icon: 'cloud' }, ctx.session ? catContext(ctx) : ui.needSession('catastrophe context'), ui.linkouts(R.directories.marketReports.filter((e) => /Munich|Swiss/.test(e.name)), null, { compact: true })),
        ui.section('6. Reinsurance / retrocession context', { icon: 'tree' }, ui.warning(RE_WARN, 'amber'), ui.dir('marketReports', null, { compact: true }), ui.warning(ILS_WARN, 'amber', 'ILS / cat bonds.')),
        ui.section('7. Broker / MGA / TPA context', { icon: 'link', desc: 'Intermediaries and delegated-authority holders are authorized via regulator registers (e.g. FCA register, NAIC/state DOIs).' }, ui.linkouts(R.directories.insuranceRegulators.filter((e) => /FCA|NAIC|Lloyd|EIOPA/.test(e.name)), null, { compact: true })),
        ui.section('8. Procurement intersection', { icon: 'doc', desc: 'Publicly tendered broker panels, claims platforms, actuarial services and captive management. US federal awards are live; other portals are link-out.' }, ctx.session ? ui.taskPanel(T.usaAwards({ keyword: isEntity ? name : /insur|broker|claims|actuar|captive|reinsur/i.test(q) ? q : 'insurance brokerage', kind: 'contracts' }), { limit: 6, auto: ctx.type === 'insuranceLine' }) : null, ui.button('Open Procurement & Bid Radar', () => R.shell.go('procurement', { focus: true }), { cls: 'rq-btn-sm' })),
        ctx.session ? ui.section('Regulatory documents (Federal Register, live)', { icon: 'search' }, ui.taskPanel(T.frSearch(ctx.type === 'insuranceLine' ? q : 'insurance', { perPage: 6 }), { auto: ctx.type === 'insuranceLine', limit: 6 })) : null,
        ui.exportBar('JAQA-Insurance-Reinsurance-evidence.json', 'JAQA-Insurance-Reinsurance-evidence.csv', 'insurance')
      );
    }
  });

  R.modules.register({
    id: 'insuranceStrength',
    group: 'insurance',
    order: 31,
    icon: 'shield',
    title: 'Insurance & Reinsurance Financial Strength',
    short: 'Financial Strength',
    description: 'Public filings, solvency disclosures, regulator links and rating-agency link-outs for insurers, reinsurers, brokers, captives, MGAs, TPAs and ILS entities.',
    warnings: ['JAQA does not determine solvency, capacity, recoverability, or financial strength. Rating agencies and regulators are authoritative sources.', NOHIT, 'No coverage determination, claims advice, underwriting advice, capacity estimate, recoverable estimate or paid rating reproduction.'],
    render(ctx) {
      const gate = ctx.session && !ctx.primary ? R.entityGate(ctx, 'financial strength evidence') : null;
      const cik = ctx.resolved && ctx.resolved.cik;
      const name = ctx.primary ? (ctx.primary.data && ctx.primary.data.name) || ctx.primary.title : ctx.q;
      return h(
        'div',
        null,
        !ctx.session ? ui.needSession('insurer financial strength evidence') : gate || h('div', null, ui.recordCard(ctx.primary)),
        ctx.session ? ui.kv([
          ['Entity type (as interpreted)', ctx.chosen ? ctx.chosen.label : null],
          ['Match confidence', ctx.session.primaryConfidence || 'Unresolved'],
          ['Listed / SEC filer', cik ? 'Yes — CIK ' + cik : 'No SEC registrant identified']
        ]) : null,
        cik ? ui.section('Public filings for listed insurers/reinsurers', { icon: 'doc' }, ui.taskPanel(T.secSubs(cik), { auto: true, render: R.secSignalsView })) : null,
        ui.section('Solvency & capital disclosures (regulator link-outs)', { icon: 'gavel', desc: 'Solvency II SFCRs are published by EEA insurers; NAIC/state DOIs, PRA/FCA, BaFin, APRA, OSFI, NFRA and IRDAI hold local returns.' }, ui.dir('insuranceRegulators', null, { compact: true })),
        ui.section('Rating agencies (link-out only)', { icon: 'chart' }, ui.warning('Financial strength ratings are licensed. JAQA never scrapes, reproduces or derives a rating.', 'info'), ui.dir('ratingAgencies', null, { compact: true })),
        ctx.session && ctx.type !== 'insuranceLine' ? ui.section('Litigation signals (live, user-triggered)', { icon: 'gavel' }, ui.taskPanel(T.courts(name, 'o'), { limit: 6 })) : null,
        ui.section('Sanctions & debarment (link-out)', { icon: 'shield' }, ui.linkouts(R.directories.sanctions.slice(0, 7), null, { compact: true })),
        ui.section('ILS / cat bond & captive public resources (link-out)', { icon: 'layers' }, ui.warning(ILS_WARN, 'amber'), ui.linkouts(R.directories.insuranceRegulators.filter((e) => /Bermuda|Cayman|Guernsey|Vermont/.test(e.name)).concat(R.directories.marketReports.filter((e) => /Artemis|Lloyd/.test(e.name))), null, { compact: true }), h('p', { class: 'rq-muted' }, 'Captive cell/member data and ILS investor data are confidential and never requested.')),
        ui.exportBar('JAQA-Insurance-Financial-Strength-evidence.json', 'JAQA-Insurance-Financial-Strength-evidence.csv', 'insurance')
      );
    }
  });
})(window.JAQAWorkspace);
