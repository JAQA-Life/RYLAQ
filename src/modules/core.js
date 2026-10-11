/*
JAQA Global Risk, Finance, Insurance & Procurement Intelligence Workspace
Built for jaqa.life or enterprise intranet deployment.
JAQA™ is a trademark of JAQA.
Educational and enterprise information-discovery use only.
Not legal, compliance, credit, investment, treasury, insurance, reinsurance,
underwriting, claims, sanctions, AML, procurement, bid, award, tax, or
supply-chain assurance advice.
Covers global risk domains, finance/counterparty risk, market/macro indicators,
insurance/reinsurance counterparties, procurement, bids, tenders, awards,
grants, PPPs, concessions, regulations, events, cyber, climate, ESG, trade,
sanctions, supply chain, and third-party signals where public APIs or official
link-outs are available.
Powered by selected public APIs and official link-outs including GLEIF,
World Bank, IMF, OECD, UN, ILO, ReliefWeb, USGS, Open-Meteo, NOAA/NWS,
NASA FIRMS, CISA KEV, NVD, CPSC, NHTSA, USAspending, Federal Register,
SEC EDGAR/XBRL, TED, SAM.gov, OFAC, EU/UK/UN/BIS sanctions link-outs, EPA,
CourtListener, OpenStreetMap, Wikidata, UN Comtrade, FRED, ECB, BIS,
ACLED, GDELT, OpenCorporates, Companies House, IAIS, EIOPA, NAIC/state DOI,
FCA/PRA, BaFin, APRA, OSFI, NFRA/CBIRC, IRDAI, rating agency link-outs,
Swiss Re/Munich Re/broker market report link-outs, Lloyd’s public resources,
ILS/cat bond public sources, captive registries, UNGM, World Bank/ADB/AfDB/
IDB/EBRD/IsDB/DFC procurement, EU Funding & Tenders, IATI/AidData, WTO GPA,
OECD procurement, and national/subnational procurement portal link-outs
where available and CORS-verified.
No stored searches. No backend. No proxy. No scraping of paid/confidential sources.
No credit rating. No investment advice. No treasury advice. No insurance advice.
No sanctions clearance. No AML determination. No procurement bid advice.
© {current year} JAQA™. All rights reserved.
*/

/*
 * core.js — namespace, in-memory state, event bus, DOM helpers, icons,
 * legal text, input hygiene guards, and the request manager.
 *
 * PRIVACY ENFORCEMENT (read this before changing anything):
 *  - All state lives in the JS heap only (R.state). There is no persistence
 *    layer at all: no cookies, no browser storage, no service worker. A page
 *    refresh therefore clears everything. scripts/check-static-safety.mjs fails
 *    the build if any storage API name appears in dist/.
 *  - Search terms are never written to the URL, never logged to the console,
 *    and never included in export filenames.
 *  - Every network call goes through R.net.request(), which uses
 *    cache:"no-store", credentials:"omit", referrerPolicy:"no-referrer", and
 *    refuses to contact a source unless it is live (verified) for this session.
 *
 * LEGAL / TRADEMARK TEXT lives in R.legal below. JAQA™ must only appear in
 * legal, copyright, privacy, disclaimer, ownership, and export-metadata text.
 * Normal UI branding is "JAQA" without the symbol.
 */
(function (global) {
  'use strict';

  const R = (global.JAQAWorkspace = global.JAQAWorkspace || {});
  R.version = '1.0.0';
  R.productName = 'JAQA Global Risk, Finance, Insurance & Procurement Intelligence Workspace';
  R.host = 'jaqa.life';
  R.config = R.config || {};

  /* ------------------------------------------------------------------ *
   * Legal & branding text (brandingLegalHelpers)
   * ------------------------------------------------------------------ */
  const YEAR = new Date().getFullYear();
  const ADVICE_LIST =
    'legal, compliance, credit, investment, treasury, insurance, reinsurance, underwriting, claims, sanctions, AML, procurement, bid, award, tax, or supply-chain assurance advice';
  R.legal = {
    year: YEAR,
    trademark: 'JAQA™',
    copyright: `© ${YEAR} JAQA™. All rights reserved.`,
    trademarkNotice: 'JAQA™ is a trademark of JAQA.',
    shortDisclaimer: `Educational and enterprise information-discovery use only. Not ${ADVICE_LIST}.`,
    privacyLegalSentence: `JAQA™ is a trademark of JAQA. This tool is provided for educational, research, and enterprise information-discovery purposes only. It does not provide ${ADVICE_LIST}.`,
    longDisclaimer: [
      'This tool is provided for educational, research, and enterprise information-discovery purposes only.',
      'Do not use for supplier approval, insurer/reinsurer/broker selection, underwriting, claims, coverage determinations, sanctions clearance, credit decisions, legal determinations, procurement bid/no-bid decisions, award decisions, grant applications, investment decisions, treasury hedging, tax decisions, or supply-chain assurance without qualified professional review.',
      'Public records may be incomplete, delayed, ambiguous, mistranslated, restated, or incorrectly matched.',
      'No public match found does not mean cleared, safe, authorized, solvent, eligible, insured, covered, or low risk.',
      'JAQA is not a sanctions screening system of record.',
      'JAQA is not a credit rating agency.',
      'JAQA is not an insurance broker, underwriter, actuary, claims adjuster, or coverage interpreter.',
      'JAQA is not a procurement advisor, bid manager, contract evaluator, or award authority.',
      'JAQA is not a real-time supply chain control tower.',
      'JAQA does not scan live systems or access private asset inventories.',
      'JAQA does not reproduce paid data or scrape paywalled sources.',
      'JAQA does not assist bid rigging, collusion, market allocation, corruption, sanctions evasion, export-control evasion, tax evasion, or anti-competitive conduct.',
      `JAQA™ does not provide ${ADVICE_LIST}.`,
      'JAQA™ is not responsible for decisions made using this interface.',
      'JAQA™ is an independent interface and is not affiliated with or endorsed by these providers unless expressly stated.',
      `© ${YEAR} JAQA™. All rights reserved.`
    ],
    privacyStatement:
      'JAQA does not store, proxy, log, persist, or analyze user searches. Searches are sent directly from the user’s browser to selected public data providers. Hosting providers and data providers may maintain their own infrastructure logs according to their own policies.',
    privacyBadge:
      'JAQA Privacy: Your searches are sent directly from your browser to selected public data providers and are not stored by JAQA.',
    commercialWarning:
      'Do not enter confidential contract terms, pricing, bid documents, underwriting files, claims files, policy numbers, insured names, claimant names, bank details, payment card data, loan applications, KYC documents, internal risk ratings, hedge positions, trading positions, invoice-level customer data, personal financial data, personal health data, M&A information, or protected commercial information.',
    sensitiveWarning:
      'Do not enter confidential commercial, financial, insurance, claims, procurement, personal, health, bank, payment, or protected information. This tool is not for PHI or protected commercial data.',
    noHitNotClear: 'No public match found does not mean cleared, safe, authorized, solvent, eligible, insured, covered, or low risk.',
    determinations: 'JAQA does not provide clearance, coverage, credit, bid, award, or legal determinations.'
  };

  /** Legal metadata block attached to every JSON export. */
  R.legal.exportBlock = function exportBlock(dataSources) {
    return {
      generatedBy: R.productName,
      host: R.host,
      generatedAt: new Date().toISOString(),
      dataSources: dataSources || [],
      legal: {
        trademark: 'JAQA™',
        copyright: R.legal.copyright,
        trademarkNotice: R.legal.trademarkNotice,
        disclaimer: R.legal.shortDisclaimer,
        noHitNotClear: R.legal.noHitNotClear,
        privacy: R.legal.privacyStatement,
        affiliation: 'JAQA™ is an independent interface and is not affiliated with or endorsed by these providers unless expressly stated.'
      }
    };
  };

  /* ------------------------------------------------------------------ *
   * Event bus (in-memory cross-module handoff; never touches the URL)
   * ------------------------------------------------------------------ */
  const listeners = new Map();
  R.events = {
    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return () => listeners.get(name).delete(fn);
    },
    emit(name, payload) {
      const set = listeners.get(name);
      if (!set) return;
      for (const fn of [...set]) {
        try {
          fn(payload);
        } catch (e) {
          // Never log payloads (they may contain search terms); log only the event name.
          console.error('[JAQA] handler error for event', name);
        }
      }
    }
  };

  /* ------------------------------------------------------------------ *
   * In-memory state. R.state.reset() is the single "Clear Session" path.
   * ------------------------------------------------------------------ */
  function freshPrefs() {
    return {
      theme: 'ops', // 'ops' (situation-room HUD) | 'dark' | 'light' | 'system'
      density: 'comfortable', // 'comfortable' | 'compact'
      hiddenGroups: new Set(),
      hiddenSources: new Set(),
      warningsCompact: false,
      marketCompact: false,
      highlightGaps: true,
      officialLinkOnly: false, // when true, link-outs never carry the query term
      viewMode: 'cards' // 'cards' | 'table'
    };
  }
  R.state = {
    generation: 0,
    session: null,
    prefs: freshPrefs(),
    watchlist: [],
    keys: {}, // optional user-entered API keys, memory only, never logged/exported
    currentModule: 'overview',
    helpDismissed: false,
    // Situation Room feeds: fixed, non-personal queries that survive new
    // searches but are wiped by Clear Session / refresh like everything else.
    feedTasks: new Map(),
    feedGen: 0,
    globeView: null,
    reset() {
      this.generation += 1;
      this.feedGen += 1;
      this.feedTasks = new Map();
      this.globeView = null;
      if (this.session && this.session.controller) this.session.controller.abort();
      this.session = null;
      this.prefs = freshPrefs();
      this.watchlist = [];
      this.keys = {};
      this.currentModule = 'overview';
      this.helpDismissed = false;
      if (R.net) R.net.resetCache();
      if (R.runtime) R.runtime.reset();
      R.events.emit('session:cleared');
    }
  };

  /* ------------------------------------------------------------------ *
   * DOM helpers. All text goes through textContent / createTextNode, so API
   * strings can never inject markup. innerHTML is never used with data.
   * ------------------------------------------------------------------ */
  // https, mailto, in-page anchors, the 3D globe (/globe/…) and the licences page on this site.
  const SAFE_URL = /^(https:\/\/|mailto:|#|\/globe\/|\/licenses\/$)/i;
  function safeUrl(u) {
    if (typeof u !== 'string') return null;
    const t = u.trim();
    if (!SAFE_URL.test(t)) return null;
    return t;
  }

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = String(v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'href') {
          const s = safeUrl(v);
          if (s) el.setAttribute('href', s);
        } else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, String(v));
      }
    }
    append(el, children);
    return el;
  }
  function append(el, children) {
    for (const c of children) {
      if (c === null || c === undefined || c === false) continue;
      if (Array.isArray(c)) append(el, c);
      else if (c instanceof Node) el.appendChild(c);
      else el.appendChild(document.createTextNode(String(c)));
    }
    return el;
  }
  function clear(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  /* Inline SVG icons (static, trusted path data only). */
  const ICONS = {
    search: 'M10.5 3a7.5 7.5 0 015.9 12.1l4.2 4.2-1.4 1.4-4.2-4.2A7.5 7.5 0 1110.5 3zm0 2a5.5 5.5 0 100 11 5.5 5.5 0 000-11z',
    shield: 'M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5l8-3zm0 2.1L6 6.4V11c0 3.9 2.5 7.4 6 8.9 3.5-1.5 6-5 6-8.9V6.4l-6-2.3z',
    lock: 'M7 10V7a5 5 0 0110 0v3h1a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2h1zm2 0h6V7a3 3 0 00-6 0v3z',
    external: 'M14 3h7v7h-2V6.4l-9.3 9.3-1.4-1.4L17.6 5H14V3zM5 5h6v2H5v12h12v-6h2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z',
    close: 'M6.4 5L12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z',
    info: 'M11 7h2v2h-2V7zm0 4h2v6h-2v-6zm1-9a10 10 0 110 20 10 10 0 010-20zm0 2a8 8 0 100 16 8 8 0 000-16z',
    warn: 'M12 2l10 18H2L12 2zm0 4.2L5.4 18h13.2L12 6.2zM11 10h2v4h-2v-4zm0 5h2v2h-2v-2z',
    trash: 'M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9zm4 2v8h2v-8h-2zm4 0v8h2v-8h-2z',
    download: 'M11 3h2v9.6l3.3-3.3 1.4 1.4L12 16.4l-5.7-5.7 1.4-1.4 3.3 3.3V3zM4 18h16v2H4v-2z',
    pin: 'M14 2l8 8-2 1-3-1-4 4 1 5-2 2-4-5-5 5-1-1 5-5-5-4 2-2 5 1 4-4-1-3 1-2z',
    globe: 'M12 2a10 10 0 110 20 10 10 0 010-20zm6.9 9a7 7 0 00-4.2-5.6c.6 1.5 1 3.4 1.2 5.6h3zm-5 0c-.3-3-1.2-5-1.9-5.6-.7.6-1.6 2.6-1.9 5.6h3.8zm-5.8 0c.1-2.2.6-4.1 1.2-5.6A7 7 0 005.1 11h3zm-3 2a7 7 0 004.2 5.6c-.6-1.5-1-3.4-1.2-5.6h-3zm5 0c.3 3 1.2 5 1.9 5.6.7-.6 1.6-2.6 1.9-5.6h-3.8zm5.8 0c-.1 2.2-.6 4.1-1.2 5.6a7 7 0 004.2-5.6h-3z',
    building: 'M4 21V3h11v6h5v12H4zm2-2h3v-3h2v3h2V5H6v14zm9 0h3v-8h-3v8zM8 7h2v2H8V7zm0 4h2v2H8v-2z',
    chart: 'M4 20V4h2v14h14v2H4zm4-4V10h2v6H8zm4 0V7h2v9h-2zm4 0v-4h2v4h-2z',
    coin: 'M12 3c4.4 0 8 1.8 8 4v10c0 2.2-3.6 4-8 4s-8-1.8-8-4V7c0-2.2 3.6-4 8-4zm0 2C8.4 5 6 6.3 6 7s2.4 2 6 2 6-1.3 6-2-2.4-2-6-2zm6 5c-1.5.9-3.6 1-6 1s-4.5-.1-6-1v2c0 .7 2.4 2 6 2s6-1.3 6-2v-2zm0 5c-1.5.9-3.6 1-6 1s-4.5-.1-6-1v2c0 .7 2.4 2 6 2s6-1.3 6-2v-2z',
    umbrella: 'M11 2h2v1.1A9 9 0 0121 12h-8v7a3 3 0 01-6 0h2a1 1 0 002 0v-7H3a9 9 0 018-8.9V2zm1 3a7 7 0 00-6.7 5h13.4A7 7 0 0012 5z',
    gavel: 'M13.8 2.4l7.8 7.8-2.8 2.8-1.4-1.4-2.1 2.1 5.7 5.7-2.1 2.1-5.7-5.7-2.1 2.1 1.4 1.4-2.8 2.8-7.8-7.8L4.7 11l1.4 1.4 5-5L9.6 6l2.8-2.8 1.4-.8z',
    doc: 'M6 2h8l6 6v14H6V2zm2 2v16h10V9h-5V4H8zm7 .8V7h2.2L15 4.8zM10 12h6v2h-6v-2zm0 4h6v2h-6v-2z',
    bug: 'M9 3l1.3 2h3.4L15 3h2l-1.6 2.6A5 5 0 0117 9h3v2h-3v2h3v2h-3a5 5 0 01-10 0H4v-2h3v-2H4V9h3a5 5 0 011.6-3.4L7 3h2zm3 4a3 3 0 00-3 3v5a3 3 0 006 0v-5a3 3 0 00-3-3z',
    cloud: 'M7 19a5 5 0 01-.9-9.9A6 6 0 0117.7 8 5.5 5.5 0 0117.5 19H7zm0-2h10.5a3.5 3.5 0 00.1-7l-1.4-.1-.3-1.3a4 4 0 00-7.7-.4l-.4 1.1-1.2.2A3 3 0 007 17z',
    leaf: 'M20 3c0 9-4 15-11 15-1.2 0-2.3-.2-3.2-.6L4.4 20 3 18.6l2.1-2.1A7 7 0 014 13C4 6 11 3 20 3zm-2.1 2.1C12 5.6 6 8 6 13c0 .8.1 1.5.4 2.1l6.9-6.9 1.4 1.4-6.9 6.9c.6.3 1.3.4 2.1.4 5 0 7.5-4.7 8-11.8z',
    ship: 'M11 2h2v3h4v6l3 1-3 8a5 5 0 01-5-2 5 5 0 01-5 2l-3-8 3-1V5h4V2zm-2 5v3.3l3-1 3 1V7H9z',
    link: 'M10.6 13.4a1 1 0 010-1.4l3-3a1 1 0 011.4 1.4l-3 3a1 1 0 01-1.4 0zM8 17a3 3 0 01-2.1-5.1l2.8-2.8 1.4 1.4-2.8 2.8a1 1 0 001.4 1.4l2.8-2.8 1.4 1.4-2.8 2.8A3 3 0 018 17zm8-2.3l-1.4-1.4 2.8-2.8a1 1 0 00-1.4-1.4l-2.8 2.8-1.4-1.4 2.8-2.8a3 3 0 014.2 4.2L16 14.7z',
    layers: 'M12 2l10 5-10 5L2 7l10-5zm0 2.2L6.5 7 12 9.8 17.5 7 12 4.2zM2 12l2-1 8 4 8-4 2 1-10 5-10-5zm0 5l2-1 8 4 8-4 2 1-10 5-10-5z',
    tree: 'M10 3h4v4h-1v3h6v4h1v4h-4v-4h1v-2h-4v2h1v4h-4v-4h1v-2H7v2h1v4H4v-4h1v-4h6V7h-1V3z',
    flask: 'M9 2h6v2h-1v5.3l5.6 9.3A2 2 0 0117.9 22H6.1a2 2 0 01-1.7-3.4L10 9.3V4H9V2zm3 8.4L8.4 16h7.2L12 10.4z',
    list: 'M4 5h2v2H4V5zm4 0h12v2H8V5zM4 11h2v2H4v-2zm4 0h12v2H8v-2zm-4 6h2v2H4v-2zm4 0h12v2H8v-2z',
    sliders: 'M4 5h10v2H4V5zm14 0h2v2h-2v1h-2V4h2v1zM4 11h4v2H4v-2zm6-1h2v4h-2v-1H8v-2h2v-1zm4 1h6v2h-6v-2zM4 17h12v2H4v-2zm14-1h2v4h-2v-1h-2v-2h2v-1z',
    gauge: 'M12 4a10 10 0 019.4 13.5l-.3.5H2.9l-.3-.5A10 10 0 0112 4zm0 2a8 8 0 00-7.7 10h15.4A8 8 0 0012 6zm4.2 2.4l1.4 1.4-4.2 4.2a1.5 1.5 0 11-1.4-1.4l4.2-4.2z',
    moon: 'M12.1 3a7 7 0 008.9 8.9A9 9 0 1112.1 3z',
    command: 'M7 3a4 4 0 014 4v1h2V7a4 4 0 114 4h-1v2h1a4 4 0 11-4 4v-1h-2v1a4 4 0 11-4-4h1v-2H7a4 4 0 010-8zm0 2a2 2 0 000 4h2V7a2 2 0 00-2-2zm10 0a2 2 0 00-2 2v2h2a2 2 0 000-4zm-6 6v2h2v-2h-2zm-4 4a2 2 0 102 2v-2H7zm8 0v2a2 2 0 102-2h-2z',
    help: 'M12 2a10 10 0 110 20 10 10 0 010-20zm0 2a8 8 0 100 16 8 8 0 000-16zm-1 11h2v2h-2v-2zm1-9a4 4 0 012 7.5c-.7.4-1 .8-1 1.5h-2c0-1.5.8-2.5 2-3.2A2 2 0 1010 10H8a4 4 0 014-4z',
    menu: 'M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z',
    refresh: 'M12 4a8 8 0 017.4 5H17v2h6V5h-2v2.3A10 10 0 002 12h2a8 8 0 018-8zm8 8a8 8 0 01-14.8 3H7v-2H1v6h2v-2.3A10 10 0 0022 12h-2z',
    copy: 'M8 3h11v13h-2V5H8V3zM4 7h11v14H4V7zm2 2v10h7V9H6z',
    print: 'M6 2h12v5h2a2 2 0 012 2v8h-4v5H6v-5H2V9a2 2 0 012-2h2V2zm2 2v3h8V4H8zm0 11v5h8v-5H8z',
    check: 'M9 16.2l-4.2-4.2-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z',
    chevron: 'M9 6l6 6-6 6-1.4-1.4 4.6-4.6-4.6-4.6L9 6z',
    grid: 'M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8-2h8v8h-8v-8zm2 2v4h4v-4h-4z',
    calendar: 'M7 2h2v2h6V2h2v2h3v18H4V4h3V2zM6 10v10h12V10H6zm0-4v2h12V6H6z',
    key: 'M7 10a5 5 0 019.6-2H22v4h-2v3h-3v-3h-.4A5 5 0 017 10zm5-3a3 3 0 100 6 3 3 0 000-6z'
  };
  const SVGNS = 'http://www.w3.org/2000/svg';
  function icon(name, cls) {
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'rq-icon' + (cls ? ' ' + cls : ''));
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', ICONS[name] || ICONS.info);
    p.setAttribute('fill', 'currentColor');
    svg.appendChild(p);
    return svg;
  }

  /**
   * External link helper. EVERY outbound link in the app is created here so
   * that target="_blank" is always paired with rel="noopener noreferrer".
   */
  function extLink(href, label, opts) {
    const o = opts || {};
    const url = safeUrl(href);
    if (!url) return h('span', { class: 'rq-muted' }, label, ' (link unavailable)');
    const a = h('a', { class: 'rq-ext' + (o.cls ? ' ' + o.cls : ''), href: url, target: '_blank', rel: 'noopener noreferrer' });
    append(a, [label, icon('external', 'rq-icon-xs'), h('span', { class: 'rq-sr' }, ' (opens official source in a new tab)')]);
    return a;
  }

  const fmt = {
    date(v) {
      if (!v) return 'Not reported by source';
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return d.toISOString().slice(0, 10);
    },
    time(d) {
      const x = d instanceof Date ? d : new Date(d);
      return isNaN(x.getTime()) ? '' : x.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    },
    num(v, digits) {
      if (v === null || v === undefined || v === '' || isNaN(Number(v))) return 'Not reported by source';
      return Number(v).toLocaleString('en-US', { maximumFractionDigits: digits === undefined ? 2 : digits });
    },
    money(v, cur) {
      if (v === null || v === undefined || v === '' || isNaN(Number(v))) return 'Not reported by source';
      const n = Number(v);
      const abs = Math.abs(n);
      const s = abs >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : abs >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : abs >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(0);
      return (cur || 'USD') + ' ' + s;
    },
    val(v) {
      if (v === null || v === undefined || v === '') return 'Not reported by source';
      if (Array.isArray(v)) return v.length ? v.join(', ') : 'Not reported by source';
      return String(v);
    },
    truncate(s, n) {
      const t = String(s || '');
      return t.length > n ? t.slice(0, n - 1) + '…' : t;
    }
  };

  let uidCounter = 0;
  const uid = (p) => (p || 'rq') + '-' + (++uidCounter).toString(36);

  /* Polite live region for loading / error / status announcements. */
  function announce(msg) {
    const el = document.getElementById('rq-live');
    if (!el) return;
    el.textContent = '';
    setTimeout(() => {
      el.textContent = msg;
    }, 30);
  }

  R.util = { h, append, clear, icon, extLink, safeUrl, fmt, uid, announce, ICONS };

  /* ------------------------------------------------------------------ *
   * Input hygiene (commercialConfidentialityGuard, personalFinancialDataGuard,
   * narrativeGuard). Rejected input is neither stored nor logged; the UI
   * shows only a generic message.
   * ------------------------------------------------------------------ */
  const MAX_LEN = 140;
  const GENERIC_REJECT =
    'This input appears too broad or may contain sensitive information. Please search a company, insurer, reinsurer, broker, LEI, ticker, CIK, country, port, HS code, CVE, tender, award, grant, PPP, recall, regulation, finance risk type, or procurement concept.';

  function mod97(str) {
    let rem = 0;
    for (const ch of str) {
      const code = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
      for (const d of code) rem = (rem * 10 + Number(d)) % 97;
    }
    return rem;
  }
  const isValidLei = (s) => /^[A-Z0-9]{18}[0-9]{2}$/.test(s) && mod97(s) === 1;
  const isValidIban = (s) => {
    const t = s.replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(t)) return false;
    return mod97(t.slice(4) + t.slice(0, 4)) === 1;
  };
  const luhn = (digits) => {
    let sum = 0;
    let alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let n = Number(digits[i]);
      if (alt) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  };

  // Known public identifier formats are allowed before the sensitive-data heuristics run.
  const PUBLIC_ID_PATTERNS = [
    /^CVE-\d{4}-\d{4,}$/i,
    /^CWE-\d{1,5}$/i,
    /^(CIK\s*)?\d{1,10}$/i,
    /^(HS\s*)?\d{4}([.\s]?\d{2}){0,3}$/i,
    /^\d{2}[VETC]\d{6}$/i,
    /^\d{4}-\d{5}$/,
    /^\d{1,8}-\d{4}$/,
    /^\d{4}\/S \d{3}-\d{6}$/i
  ];

  const SENSITIVE_KEYWORDS = [
    'policy no', 'policy number', 'policy #', 'claim no', 'claim number', 'claim #', 'claim id', 'claimant', 'insured name', 'member id',
    'patient', 'diagnosis', 'mrn', 'medical record', 'date of birth', 'dob', 'born on', 'ssn', 'social security', 'national insurance number',
    'passport', 'driver licen', 'account no', 'account number', 'acct', 'sort code', 'routing number', 'swift code', 'iban', 'bic code', 'card number', 'cvv',
    'password', 'salary', 'payroll', 'employee id', 'bid price', 'our price', 'our bid', 'pricing sheet', 'cost breakdown', 'margin', 'discount',
    'confidential', 'internal only', 'strictly private', 'not for distribution', 'term sheet', 'covenant', 'hedge position', 'trading position',
    'invoice #', 'invoice no', 'kyc', 'loan application', 'credit limit', 'treaty terms', 'retrocession chain', 'collateral detail',
    'negotiation', 'm&a', 'merger target', 'valuation model', 'classified', 'export-controlled', 'itar data', 'workaround', 'evade', 'evasion', 'bypass sanctions', 'rig the bid', 'bid rigging'
  ];

  R.privacy = {
    GENERIC_REJECT,
    isValidLei,
    /**
     * Returns { ok, value, reason }. `reason` is always the generic message —
     * the specific trigger is intentionally not surfaced or recorded.
     */
    checkInput(raw) {
      if (typeof raw !== 'string') return { ok: false, reason: GENERIC_REJECT };
      if (/[\r\n\t]/.test(raw.trim())) return { ok: false, reason: GENERIC_REJECT };
      // eslint-disable-next-line no-control-regex
      if (/[\u0000-\u001f<>{}]/.test(raw)) return { ok: false, reason: GENERIC_REJECT };
      const value = raw.replace(/\s+/g, ' ').trim();
      if (!value) return { ok: false, reason: 'Enter a company, insurer, LEI, country, port, HS code, CVE, tender, regulation, or risk concept to begin.' };
      if (value.length > MAX_LEN) return { ok: false, reason: GENERIC_REJECT };
      const upper = value.toUpperCase();
      if (isValidLei(upper)) return { ok: true, value: upper };
      if (PUBLIC_ID_PATTERNS.some((re) => re.test(value))) return { ok: true, value };
      const lower = value.toLowerCase();
      if (SENSITIVE_KEYWORDS.some((k) => (k.length <= 4 ? new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\#&]/g, '\\$&') + '\\b').test(lower) : lower.includes(k))))
        return { ok: false, reason: GENERIC_REJECT };
      if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(value)) return { ok: false, reason: GENERIC_REJECT }; // email
      if (/\b\d{3}-\d{2}-\d{4}\b/.test(value)) return { ok: false, reason: GENERIC_REJECT }; // SSN-like
      if (/\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/.test(value)) return { ok: false, reason: GENERIC_REJECT }; // DOB-like date
      if (isValidIban(value)) return { ok: false, reason: GENERIC_REJECT };
      const digitRuns = value.replace(/[\s-]/g, '').match(/\d{12,}/g) || [];
      if (digitRuns.length) return { ok: false, reason: GENERIC_REJECT }; // card/account-like
      const cardLike = value.match(/(?:\d[ -]?){13,19}/g) || [];
      if (cardLike.some((c) => luhn(c.replace(/\D/g, '')))) return { ok: false, reason: GENERIC_REJECT };
      const phoneDigits = (value.match(/\+?[\d\s().-]{9,}/g) || []).map((p) => p.replace(/\D/g, ''));
      if (phoneDigits.some((d) => d.length >= 9 && d.length <= 15) && /[+()\s.-]/.test(value)) return { ok: false, reason: GENERIC_REJECT };
      if (/\b(MRN|PT|CLM|POL)[-#:\s]?\d{5,}\b/i.test(value)) return { ok: false, reason: GENERIC_REJECT };
      if (value.split(' ').length > 10) return { ok: false, reason: GENERIC_REJECT }; // narrative-like
      return { ok: true, value };
    }
  };

  /* ------------------------------------------------------------------ *
   * Module registry
   * ------------------------------------------------------------------ */
  const moduleList = [];
  R.modules = {
    register(def) {
      if (!def || !def.id) throw new Error('module id required');
      const i = moduleList.findIndex((m) => m.id === def.id);
      if (i >= 0) moduleList[i] = def;
      else moduleList.push(def);
      moduleList.sort((a, b) => (a.order || 0) - (b.order || 0));
    },
    get: (id) => moduleList.find((m) => m.id === id),
    all: () => moduleList.slice(),
    GROUPS: [
      { id: 'risk', label: 'Risk' },
      { id: 'finance', label: 'Finance' },
      { id: 'insurance', label: 'Insurance & Reinsurance' },
      { id: 'procurement', label: 'Procurement & Bids' },
      { id: 'evidence', label: 'Evidence' },
      { id: 'arsenal', label: 'Arsenal' }
    ]
  };
})(window);
