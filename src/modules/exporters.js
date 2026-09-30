/*
 * exporters.js — browser-side JSON/CSV export, copy helpers and print.
 *
 * - Files are generated in the browser (Blob) and never uploaded or kept.
 * - Filenames are fixed and never contain search terms.
 * - CSV cells are sanitized against formula injection: any cell starting
 *   with =, +, -, @, tab or carriage return is prefixed with a single quote.
 * - JSON exports carry provenance, confidence, freshness, coverage gaps and
 *   the JAQA™ legal metadata block. API keys and secrets are never exported.
 * - When an export would contain the user's search term, the user is warned
 *   and must confirm before download/copy.
 */
(function (R) {
  'use strict';
  const { h } = R.util;

  function csvCell(v) {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    s = s.replace(/"/g, '""');
    return /[",\n\r]/.test(s) || s !== s.trim() ? `"${s}"` : s;
  }
  function toCSV(rows) {
    return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: '#', download: filename });
    a.setAttribute('href', url); // blob: URL set directly (not an external link)
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    R.util.announce('Export ready: ' + filename);
  }

  function recordJSON(r) {
    return {
      title: r.title,
      subtitle: r.subtitle,
      kind: r.kind,
      summary: r.summary || undefined,
      fields: Object.fromEntries(r.fields.map(([k, v]) => [k, v === null || v === undefined || v === '' ? 'Not reported by source' : v])),
      identifiers: r.ids,
      badges: r.badges.map((b) => b.text),
      flags: r.flags,
      provenance: {
        source: r.prov.sourceName,
        sourceId: r.prov.sourceId,
        endpoint: r.prov.endpoint,
        recordId: r.prov.recordId,
        officialUrl: r.prov.url,
        retrievedAt: r.prov.retrievedAt.toISOString(),
        dataCategory: r.prov.category,
        matchConfidence: r.prov.confidence || null,
        attribution: r.prov.attribution
      }
    };
  }

  function coverageSnapshot(sourceIds) {
    const ids = sourceIds || R.sources.list.map((s) => s.id);
    return ids
      .map((id) => R.sources.get(id))
      .filter(Boolean)
      .map((s) => ({
        source: s.displayName,
        id: s.id,
        tier: s.tier,
        defaultMode: s.defaultMode,
        runtimeMode: R.runtime.mode(s.id),
        corsVerified: s.corsVerified,
        coverageGap: s.coverageGapWarning || null,
        falseNegativeRisk: s.falseNegativeRisk,
        mayLagOfficialDb: s.mayLagOfficialDb,
        translationRisk: s.translationRisk,
        deadlineRisk: s.deadlineRisk,
        officialSourceAuthoritative: s.officialSourceAuthoritative,
        legalReviewRequired: s.legalReviewRequired,
        attribution: s.attribution
      }));
  }

  const DOMAIN_WARNINGS = {
    finance: 'No credit score, credit rating, solvency opinion, investment, treasury or hedging advice is generated. Public distress signals do not predict insolvency.',
    insurance: 'No insurance, reinsurance, underwriting, claims, coverage, solvency, capacity or recoverability determination is made. Ratings and market reports are link-out only.',
    sanctions: 'No hit ≠ clear. JAQA is not a sanctions screening system of record or an AML system.',
    procurement: 'Deadlines, timezones, eligibility, lots, amendments and translations must be verified on the official procurement portal. No bid/no-bid advice, award prediction or eligibility determination.',
    globalRisk: 'Coverage is incomplete by region, sector, language and source. The taxonomy is a public-source map, not a risk measurement.'
  };

  function sessionMeta() {
    const s = R.state.session;
    if (!s) return null;
    return {
      interpretedType: s.chosen.label,
      interpretationConfidence: s.chosen.confidence,
      startedAt: s.startedAt.toISOString(),
      resolvedIdentifiers: Object.fromEntries(Object.entries(s.resolved).filter(([k]) => ['lei', 'cik', 'iso2', 'iso3', 'qid'].includes(k))),
      primaryEntity: s.primary ? { title: s.primary.title, confidence: s.primaryConfidence, source: s.primary.prov.sourceName } : null
    };
  }

  /** Warn before exporting content that includes the search term. */
  function confirmTerm(includesTerm, go) {
    if (!includesTerm) return go(false);
    const body = h(
      'div',
      { class: 'rq-prose' },
      h('p', null, 'This export can include your search term. Files are created in your browser and are not uploaded or stored by JAQA, but anyone you share the file with will see it.'),
      h('div', { class: 'rq-row' }, R.ui.button('Include search term', () => { R.shell.closeDialog(); go(true); }, { variant: 'primary' }), R.ui.button('Export without search term', () => { R.shell.closeDialog(); go(false); }), R.ui.button('Cancel', () => R.shell.closeDialog(), { variant: 'ghost' }))
    );
    R.shell.openDialog('Export warning', body, 'modal');
  }

  function jsonExport(filename, records, domain, extra) {
    const s = R.state.session;
    confirmTerm(!!s, (withTerm) => {
      const sources = [...new Set(records.map((r) => r.prov.sourceName))];
      const payload = Object.assign(R.legal.exportBlock(sources), {
        warnings: [R.legal.shortDisclaimer, R.legal.noHitNotClear, DOMAIN_WARNINGS[domain] || DOMAIN_WARNINGS.globalRisk].filter(Boolean),
        session: s ? Object.assign({ query: withTerm ? s.query : '[omitted by user]' }, sessionMeta()) : null,
        records: records.map(recordJSON),
        coverage: coverageSnapshot([...new Set(records.map((r) => r.prov.sourceId))]),
        extra: extra || undefined
      });
      download(filename, JSON.stringify(payload, null, 2), 'application/json');
    });
  }

  function csvExport(filename, records, domain) {
    const header = ['Title', 'Subtitle', 'Kind', 'Key fields', 'Badges', 'Source', 'Data category', 'Match confidence', 'Retrieved at (session)', 'Source record ID', 'Official URL'];
    const rows = [header].concat(
      records.map((r) => [
        r.title,
        r.subtitle,
        r.kind,
        r.fields.filter((f) => f[1] !== null && f[1] !== undefined && f[1] !== '').map(([k, v]) => `${k}: ${v}`).join(' | '),
        r.badges.map((b) => b.text).join(' | '),
        r.prov.sourceName,
        r.prov.category,
        r.prov.confidence || '',
        r.prov.retrievedAt.toISOString(),
        r.prov.recordId,
        r.prov.url
      ])
    );
    rows.push([]);
    rows.push(['Disclaimer', R.legal.shortDisclaimer]);
    rows.push(['No hit ≠ clear', R.legal.noHitNotClear]);
    if (DOMAIN_WARNINGS[domain]) rows.push(['Domain warning', DOMAIN_WARNINGS[domain]]);
    rows.push(['Legal', R.legal.copyright]);
    download(filename, '﻿' + toCSV(rows), 'text/csv');
  }

  function visibleRecords() {
    const keys = R.shell.visibleTaskKeys.size ? [...R.shell.visibleTaskKeys] : R.tasks.all().map((t) => t.key);
    return keys.map((k) => R.tasks.get(k)).filter(Boolean).flatMap((t) => t.records || []);
  }

  async function copyText(text, label, includesTerm) {
    const doCopy = async () => {
      try {
        await navigator.clipboard.writeText(text); // write-only; clipboard is never read
        R.util.announce(label + ' copied.');
      } catch (e) {
        R.util.announce('Copy failed. Your browser blocked clipboard access.');
      }
    };
    if (includesTerm) confirmTerm(true, (ok) => ok && doCopy());
    else doCopy();
  }

  function idList(key) {
    const recs = R.tasks.records().concat(R.state.watchlist);
    return [...new Set(recs.map((r) => r.ids && r.ids[key]).filter(Boolean))];
  }

  R.exporters = {
    csvCell,
    toCSV,
    recordJSON,
    json: jsonExport,
    csv: csvExport,
    sessionJSON() {
      const recs = R.tasks.records();
      jsonExport('JAQA-Workspace-results.json', recs, 'globalRisk', { tasks: R.tasks.all().map((t) => ({ label: t.label, source: t.sourceId, status: t.status, errorKind: t.errorKind || null, records: (t.records || []).length })) });
    },
    visibleCSV() {
      const recs = visibleRecords();
      if (!recs.length) return R.util.announce('No visible records to export.');
      csvExport('JAQA-Workspace-results.csv', recs, 'globalRisk');
    },
    visibleJSON(filename, domain) {
      jsonExport(filename || 'JAQA-Workspace-results.json', visibleRecords(), domain || 'globalRisk');
    },
    evidencePackJSON() {
      const recs = R.state.watchlist.length ? R.state.watchlist : R.tasks.records();
      jsonExport('JAQA-Evidence-Pack.json', recs, 'globalRisk', { evidenceBoardCount: R.state.watchlist.length, note: R.state.watchlist.length ? 'Pinned evidence board records.' : 'No pinned records; all session records included.' });
    },
    evidencePackCSV() {
      const recs = R.state.watchlist.length ? R.state.watchlist : R.tasks.records();
      csvExport('JAQA-Evidence-Pack.csv', recs, 'globalRisk');
    },
    watchlistJSON() {
      jsonExport('JAQA-Watchlist.json', R.state.watchlist, 'globalRisk');
    },
    copyIds(key, label) {
      const ids = idList(key);
      if (!ids.length) return R.util.announce('No ' + label + ' in this session.');
      copyText(ids.join('\n'), label, false);
    },
    copyLinks() {
      const recs = R.tasks.records().concat(R.state.watchlist);
      const links = [...new Set(recs.map((r) => r.prov.url).filter(Boolean))];
      copyText(links.join('\n'), 'Official source links', false);
    },
    copyPrivacy() {
      copyText([R.legal.privacyStatement, '', R.legal.privacyLegalSentence, '', ...R.legal.longDisclaimer].join('\n'), 'Privacy statement', false);
    },
    download,
    DOMAIN_WARNINGS
  };
})(window.JAQAWorkspace);
