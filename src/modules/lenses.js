/*
 * lenses.js — MODULE 15: ESG, Conduct, Human Rights & Nature; MODULE 16:
 * Trade, Customs & Category Exposure; MODULE 17: Supply Chain & Third-Party
 * Risk; MODULE 18: Regulatory Change Radar; MODULE 23: Standards,
 * Certifications & Frameworks Link-Outs.
 */
(function (R) {
  'use strict';
  const { h, extLink } = R.util;
  const ui = R.ui;
  const T = R.T;

  const subject = (ctx) => (ctx.primary ? (ctx.primary.data && ctx.primary.data.name) || ctx.primary.title : ctx.q);

  /* ------------------------------ ESG & conduct ------------------------------ */
  R.modules.register({
    id: 'esg',
    group: 'risk',
    order: 12,
    icon: 'leaf',
    title: 'ESG, Conduct, Human Rights & Nature',
    short: 'ESG & Human Rights',
    description: 'Environmental compliance records, governance indicators and official due-diligence resources for human rights, modern slavery, conflict minerals and nature.',
    warnings: ['ESG signals are not certifications. Public records do not prove or disprove forced labour, environmental misconduct, governance failures, or human-rights abuses.', 'JAQA does not rank suppliers, insurers, countries, or projects as ethical/unethical, and never scrapes paid ESG ratings.'],
    render(ctx) {
      if (!ctx.session) return h('div', null, ui.needSession('ESG evidence'), ui.dir('esg', null, { title: 'Official ESG & human-rights resources' }));
      const iso3 = R.countryFromCtx(ctx);
      const org = R.pipeline.ORG_TYPES.includes(ctx.type) || !!ctx.primary;
      return h(
        'div',
        null,
        org ? ui.section('US environmental compliance (EPA ECHO, facility-name match)', { icon: 'leaf', desc: 'User-triggered. Facility names are not legal entities; verify addresses and registry IDs.' }, ui.taskPanel(T.epa(subject(ctx)), { limit: 10 })) : null,
        iso3 ? ui.section('Governance context — ' + (R.geo.countries.find((c) => c.iso3 === iso3) || {}).name, { icon: 'gavel', desc: 'Worldwide Governance Indicators (estimates with margins of error; not a rating).' }, h('div', { class: 'rq-indicator-grid' }, ...['wgiCC', 'wgiRL', 'wgiVA'].map((k) => ui.taskPanel(T.wbInd(iso3, k), { compact: true })))) : null,
        ui.section('Modern slavery, forced labour & human rights (link-out)', { icon: 'link' }, ui.linkouts(R.directories.esg.filter((e) => /slavery|forced|child|Guiding|OECD Due|withhold/i.test(e.name)), null, { compact: true }), ui.linkouts(R.directories.sanctions.filter((e) => /UFLPA/.test(e.name)), null, { compact: true })),
        ui.section('Conflict minerals, nature & biodiversity (link-out)', { icon: 'leaf' }, ui.linkouts(R.directories.esg.filter((e) => /minerals|Minerals|TNFD/.test(e.name)), null, { compact: true })),
        ui.section('Integrity & governance indexes (link-out)', { icon: 'chart' }, ui.linkouts(R.directories.esg.filter((e) => /Governance|Transparency/.test(e.name)), null, { compact: true })),
        ui.section('Regulatory & litigation cross-links', { icon: 'gavel' }, ui.button('Open Regulatory Change Radar', () => R.shell.go('regulatory', { focus: true }), { cls: 'rq-btn-sm' }), ui.button('Open Credit, Insolvency & Litigation', () => R.shell.go('credit', { focus: true }), { cls: 'rq-btn-sm' })),
        ui.exportBar('JAQA-ESG-results.json', 'JAQA-ESG-results.csv', 'globalRisk')
      );
    }
  });

  /* --------------------------- Trade & category --------------------------- */
  R.modules.register({
    id: 'trade',
    group: 'risk',
    order: 13,
    icon: 'ship',
    title: 'Trade, Customs & Category Exposure',
    short: 'Trade & Category',
    description: 'HS code and category context, tariff and trade-remedy notices, country trade indicators, and customs/export-control link-outs.',
    warnings: ['Trade data is aggregated and may lag. Public trade data does not reveal confidential customer-supplier relationships. No shipment-level visibility.', 'HS classification shown here is not customs legal advice. Verify with the official tariff and customs rulings.'],
    render(ctx) {
      if (!ctx.session) return h('div', null, ui.needSession('trade and category context'), ui.dir('trade', null, { title: 'Official trade & customs sources' }));
      const c = ctx.chosen;
      const hs = c.type === 'hs' ? c.hs : null;
      const hints = c.type === 'category' ? c.hsHints || [] : [];
      const iso3 = R.countryFromCtx(ctx);
      const hs4 = hs ? hs.replace(/\D/g, '').slice(0, 4) : null;
      return h(
        'div',
        null,
        hs
          ? ui.section('HS code ' + hs, { icon: 'doc', desc: 'Harmonized System code as entered. Chapter/heading descriptions are authoritative only in the official tariff.' }, ui.kv([['HS chapter', hs.replace(/\D/g, '').slice(0, 2)], ['HS heading', hs4], ['HS subheading (6-digit)', hs.replace(/\D/g, '').slice(0, 6) || null], ['National tariff lines', 'Digits beyond 6 are country-specific (e.g. US HTS, EU CN/TARIC)']]), h('div', { class: 'rq-row' }, extLink('https://hts.usitc.gov/search?query=' + encodeURIComponent(hs4), 'USITC HTS: heading ' + hs4), extLink('https://www.trade-tariff.service.gov.uk/search?q=' + encodeURIComponent(hs4), 'UK Trade Tariff: ' + hs4), extLink('https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp', 'EU TARIC consultation')))
          : null,
        hints.length ? ui.section('Category → HS heading hints', { icon: 'layers', desc: 'Indicative WCO HS headings commonly associated with this category. Verify classification with customs specialists.' }, h('div', { class: 'rq-row' }, ...hints.map((x) => ui.button('HS ' + x, () => R.shell.search('HS ' + x), { cls: 'rq-btn-sm' })))) : null,
        ui.section('Tariff, trade-remedy & customs notices (Federal Register, live)', { icon: 'search' }, ui.taskPanel(T.frSearch(hs ? 'HTS ' + hs4 : (c.type === 'category' ? ctx.q + ' tariff' : 'tariff ' + ctx.q), { perPage: 8, order: 'newest' }), { auto: c.type === 'hs' || c.type === 'category', limit: 8 })),
        iso3 ? ui.section('Country trade indicators', { icon: 'chart' }, h('div', { class: 'rq-indicator-grid' }, ...['trade', 'hightech', 'lpi'].map((k) => ui.taskPanel(T.wbInd(iso3, k), { compact: true })))) : null,
        c.type === 'category' ? ui.section('Product-safety signals for this category (CPSC, live)', { icon: 'warn' }, ui.taskPanel(T.cpscSearch(ctx.q), { auto: true, limit: 6 })) : null,
        ui.section('Trade flows & tariffs (link-out)', { icon: 'link', desc: 'UN Comtrade requires an API key and is link-out only.' }, ui.dir('trade', null, { compact: true })),
        ui.section('Export controls & payment restrictions (link-out)', { icon: 'shield' }, ui.linkouts(R.directories.sanctions.filter((e) => e.kind === 'export-control' || /OFAC/.test(e.name)), null, { compact: true })),
        ui.exportBar('JAQA-Trade-Category-results.json', 'JAQA-Trade-Category-results.csv', 'globalRisk')
      );
    }
  });

  /* -------------------------- Supply chain & TPRM -------------------------- */
  R.modules.register({
    id: 'supplyChain',
    group: 'risk',
    order: 14,
    icon: 'layers',
    title: 'Supply Chain & Third-Party Risk',
    short: 'Supply Chain & Third Party',
    description: 'One place to assemble public evidence for suppliers, vendors, logistics providers, manufacturers, distributors and service providers.',
    warnings: ['Public-source triage does not replace supplier questionnaires, audits, site visits, contracts, insurance certificates, or internal vendor master data.', 'No public record found does not mean no risk.'],
    render(ctx) {
      if (!ctx.session) return ui.needSession('third-party evidence');
      const name = subject(ctx);
      const iso3 = R.countryFromCtx(ctx);
      const rows = [
        ['Organization resolution', ctx.primary ? `${ctx.primary.title} (${ctx.session.primaryConfidence})` : 'Not resolved', 'org360'],
        ['Parent/subsidiary', ctx.primary && ctx.primary.ids.lei ? 'GLEIF relationships available in Organization 360' : 'Unknown — no LEI selected', 'org360'],
        ['Country context', iso3 ? iso3 : 'No jurisdiction resolved', 'marketMacro'],
        ['Port / route / facility events', ctx.resolved.lat ? 'Reference point set' : 'No reference point', 'climate'],
        ['Trade & category exposure', ctx.type === 'hs' || ctx.type === 'category' ? 'Category query' : 'Open lens', 'trade'],
        ['Sanctions / debarment', 'Link-out only (no hit ≠ clear)', 'sanctions'],
        ['Litigation / liens / insolvency', 'User-triggered', 'credit'],
        ['Financial fragility', ctx.resolved.cik ? 'SEC filer' : 'Limited public financials', 'fragility'],
        ['Cyber signals', 'KEV/NVD (product-level only)', 'cyber'],
        ['ESG / conduct', 'Link-outs + EPA ECHO', 'esg'],
        ['Procurement award history', 'USAspending (US federal)', 'awards']
      ];
      return h(
        'div',
        null,
        ui.section('Evidence checklist', { icon: 'list', desc: 'Where each type of evidence lives in JAQA. Status reflects this session only.' }, h('div', { class: 'rq-table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Evidence checklist' }, h('table', { class: 'rq-table' }, h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Evidence area'), h('th', { scope: 'col' }, 'Session status'), h('th', { scope: 'col' }, 'Open'))), h('tbody', null, ...rows.map(([a, st, m]) => h('tr', null, h('th', { scope: 'row' }, a), h('td', null, st), h('td', null, ui.button('Open', () => R.shell.go(m, { focus: true }), { cls: 'rq-btn-xs' })))))))),
        ui.section('Quick public checks (user-triggered)', { icon: 'download' }, h('div', { class: 'rq-two-col' }, ui.taskPanel(T.cpscSearch(name), { limit: 5 }), ui.taskPanel(T.kevMentions(name.split(/\s+/)[0]), { limit: 5 }), ui.taskPanel(T.usaAwards({ recipient: name, kind: 'contracts' }), { limit: 5 }), iso3 ? ui.taskPanel(T.wbInd(iso3, 'lpi'), { compact: true }) : null)),
        ui.warning('Parent/subsidiary ambiguity: signals may belong to a related entity with a similar name. Confirm legal entity identifiers before acting.', 'amber'),
        ui.exportBar('JAQA-Counterparty-Evidence-Pack.json', 'JAQA-Counterparty-Evidence-Pack.csv', 'globalRisk')
      );
    }
  });

  /* ------------------------- Regulatory Change Radar ------------------------- */
  const reg = { term: '', type: '', from: '', to: '', run: 0 };
  R.events.on('session:cleared', () => Object.assign(reg, { term: '', type: '', from: '', to: '', run: 0 }));
  R.events.on('session:started', () => Object.assign(reg, { term: '', run: 0 }));
  R.modules.register({
    id: 'regulatory',
    group: 'risk',
    order: 15,
    icon: 'gavel',
    title: 'Regulatory Change Radar',
    short: 'Regulatory Change Radar',
    description: 'US regulatory documents (live) with agency, action type, publication, comment and effective dates, plus EU/UK and sector-regulator link-outs.',
    warnings: ['Regulatory documents are not legal advice. Jurisdiction and effective dates must be verified with counsel/compliance.'],
    render(ctx) {
      if (!ctx.session) return h('div', null, ui.needSession('regulatory documents'), ui.dir('regulatory', null, { title: 'Official regulatory sources' }));
      const term = reg.term || (ctx.chosen.frDoc ? '' : ctx.chosen.concept ? 'rule' : ctx.q);
      let draft = { term, type: reg.type, from: reg.from, to: reg.to };
      const form = h(
        'form',
        { class: 'rq-filters', onsubmit: (e) => {
          e.preventDefault();
          const chk = R.privacy.checkInput(draft.term || 'rule');
          if (!chk.ok) return R.util.announce(chk.reason);
          Object.assign(reg, draft, { term: chk.value, run: reg.run + 1 });
          R.shell.refresh();
        } },
        ui.input('Topic / keyword', term, (v) => (draft.term = v), { key: 'reg-term' }),
        ui.select('Action type', [['', 'All types'], ['RULE', 'Final rule'], ['PRORULE', 'Proposed rule'], ['NOTICE', 'Notice'], ['PRESDOCU', 'Presidential document']], reg.type, (v) => (draft.type = v), { key: 'reg-type' }),
        ui.input('Published from', reg.from, (v) => (draft.from = v), { type: 'date', key: 'reg-from' }),
        ui.input('Published to', reg.to, (v) => (draft.to = v), { type: 'date', key: 'reg-to' }),
        h('button', { type: 'submit', class: 'rq-btn rq-btn-primary' }, 'Search')
      );
      const def = ctx.chosen.frDoc && !reg.run ? T.frDoc(ctx.chosen.frDoc) : T.frSearch(term, { perPage: 15, order: 'newest', type: reg.type || undefined, from: reg.from || undefined, to: reg.to || undefined });
      return h(
        'div',
        null,
        form,
        ui.section('US Federal Register', { icon: 'doc', desc: 'Comment deadlines and effective dates as published; verify on the official document.' }, ui.taskPanel(def, { auto: true, limit: 15 })),
        ui.section('EU, UK and other jurisdictions (link-out)', { icon: 'link' }, ui.dir('regulatory', ctx.q, { compact: true })),
        ui.section('Sector regulators (link-out)', { icon: 'umbrella' }, ui.linkouts(R.directories.insuranceRegulators.slice(0, 8), null, { compact: true }), ui.linkouts(R.directories.cyber.filter((e) => /EDPB|ICO/.test(e.name)), null, { compact: true })),
        ui.exportBar('JAQA-Regulatory-Radar.json', 'JAQA-Regulatory-Radar.csv', 'globalRisk')
      );
    }
  });

  /* ---------------------- Standards & frameworks ---------------------- */
  R.modules.register({
    id: 'standards',
    group: 'risk',
    order: 16,
    icon: 'doc',
    title: 'Standards, Certifications & Frameworks Link-Outs',
    short: 'Standards & Frameworks',
    description: 'Official references for risk, continuity, security, AI, due diligence, procurement, insurance-supervision and anti-corruption frameworks.',
    warnings: ['Standards link-outs are references, not certifications. JAQA does not verify certification status unless an official public register/API is verified. Certification status is never implied.'],
    render(ctx) {
      const q = ctx.session ? ctx.q.toLowerCase().replace(/[^a-z0-9 ]/g, ' ') : '';
      const list = R.directories.standards;
      const isMatch = (e) => q && q.split(' ').filter((t) => t.length >= 3).some((t) => e.name.toLowerCase().includes(t));
      const sorted = list.slice().sort((a, b) => isMatch(b) - isMatch(a));
      return h(
        'div',
        { class: 'rq-table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Standards and frameworks' },
        h(
          'table',
          { class: 'rq-table' },
          h('thead', null, h('tr', null, ...['Standard / framework', 'Publisher', 'Relevance', 'Coverage note', 'Official link'].map((c) => h('th', { scope: 'col' }, c)))),
          h(
            'tbody',
            null,
            ...sorted.map((e) =>
              h(
                'tr',
                { class: isMatch(e) ? 'is-match' : '' },
                h('th', { scope: 'row' }, e.name, isMatch(e) ? ui.badge('Matches query', 'org') : null),
                h('td', null, e.publisher || '—'),
                h('td', null, /ISO 31000|Risk/.test(e.name) ? 'Enterprise risk' : /22301|27031|continuity/i.test(e.name) ? 'Continuity / resilience' : /27001|27035|SOC|NIST|CMMC/.test(e.name) ? 'Security & cyber' : /AI/.test(e.name) ? 'AI governance' : /OECD|Guiding|ILO/.test(e.name) ? 'Due diligence / human rights' : /FIDIC|NEC|Procurement|GPA/.test(e.name) ? 'Procurement & contracts' : /IAIS|Solvency/.test(e.name) ? 'Insurance supervision' : /UNCAC|FATF/.test(e.name) ? 'Integrity / AML' : 'Certification register'),
                h('td', null, e.kind === 'certification-register' ? 'Register for verifying certificates (link-out)' : 'Standard text may be paid; JAQA does not reproduce it. Certification status not implied.'),
                h('td', null, extLink(e.url, 'Open'))
              )
            )
          )
        )
      );
    }
  });
})(window.JAQAWorkspace);
