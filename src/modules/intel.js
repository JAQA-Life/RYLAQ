/*
 * intel.js — Arsenal Live Intel: the Arsenal projects that expose a public,
 * keyless data API, "rewrapped" to run inside the JAQA Node app.
 *
 * The browser only calls the same-origin JAQA server (/api/jaqa/intel/*), which
 * fetches the allowlisted upstreams server-side. On static-only hosting (no JAQA
 * server) the panels degrade to official link-outs. Lookup inputs (a CVE/GHSA
 * id, or an owner/repo) are validated here and again on the server; they are
 * never logged. Clear Session resets the view.
 * JAQA™ is a trademark of JAQA. © JAQA™. Licensed under AGPL-3.0-or-later.
 */
(function (R) {
  'use strict';
  const { h, extLink } = R.util;
  const ui = R.ui;

  const BASE = '/api/jaqa/intel';
  const st = { repo: '', vuln: '', scorecard: null, osv: null, msg: '' };
  R.events.on('session:cleared', () => {
    st.repo = st.vuln = st.msg = '';
    st.scorecard = st.osv = null;
  });

  const live = () => R.runtime && R.runtime.isLive && R.runtime.isLive('jaqaMonitor'); // same server backs both
  const num = (n, d) => (typeof n === 'number' ? n.toFixed(d == null ? 2 : d) : '—');
  const tone = (s) => (s == null ? 'neutral' : s >= 7 ? 'ok' : s >= 4 ? 'warn' : 'bad');

  async function getJson(pathPart) {
    const r = await fetch(BASE + pathPart, { cache: 'no-store', credentials: 'omit' });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || 'http_' + r.status);
    }
    return r.json();
  }

  /* -------- live feeds (KEV, EPSS top) rendered via taskPanel-like fetch -------- */
  function feedPanel(id, title, publisher, render) {
    const host = h('div', { class: 'rq-panel-body' }, ui.skeleton(2));
    setTimeout(() => {
      if (!host.isConnected) return;
      getJson('/feed?id=' + encodeURIComponent(id))
        .then((b) => host.replaceChildren(b.ok ? render(b.data) : ui.warning('Source unavailable right now (' + (b.error || 'error') + ').', 'amber')))
        .catch((e) => host.replaceChildren(ui.warning('Could not load (' + e.message + ').', 'amber')));
    }, 0);
    return h('section', { class: 'rq-panel', 'aria-label': title }, h('div', { class: 'rq-panel-head' }, h('span', { class: 'rq-panel-title' }, title), h('span', { class: 'rq-panel-meta' }, publisher)), host);
  }

  const kevList = (d) =>
    h('div', null,
      h('p', { class: 'rq-fineprint' }, (d.count || 0) + ' CVEs in the catalogue · showing newest ' + d.items.length + '. Version ' + (d.catalogVersion || '—') + '.'),
      h('ul', { class: 'rq-wire' }, ...d.items.map((v) =>
        h('li', { class: 'rq-wire-row' },
          h('span', { class: 'rq-wire-time rq-mono' }, v.dateAdded || '—'),
          h('span', { class: 'rq-mon-title' }, extLink('https://nvd.nist.gov/vuln/detail/' + v.cve, v.cve), ' — ' + v.name),
          v.ransomware && /known/i.test(v.ransomware) ? ui.badge('ransomware', 'bad') : null))));

  const epssList = (d) =>
    h('ul', { class: 'rq-wire' }, ...d.items.map((e) =>
      h('li', { class: 'rq-wire-row' },
        h('span', { class: 'rq-wire-time rq-mono', title: 'Exploitation probability (next 30 days)' }, (e.epss * 100).toFixed(1) + '%'),
        h('span', { class: 'rq-mon-title' }, extLink('https://nvd.nist.gov/vuln/detail/' + e.cve, e.cve)),
        h('span', { class: 'rq-mono rq-muted' }, 'pct ' + (e.percentile * 100).toFixed(0)))));

  /* --------------------------- lookups --------------------------- */
  function runScorecard(repo) {
    st.msg = '';
    getJson('/lookup?id=scorecard&q=' + encodeURIComponent(repo))
      .then((b) => { st.scorecard = b.ok ? b.data : { error: b.error }; R.shell.go('intel'); })
      .catch((e) => { st.scorecard = { error: e.message }; R.shell.go('intel'); });
  }
  function runOsv(id) {
    getJson('/lookup?id=osv&q=' + encodeURIComponent(id))
      .then((b) => { st.osv = b.ok ? b.data : { error: b.error }; R.shell.go('intel'); })
      .catch((e) => { st.osv = { error: e.message }; R.shell.go('intel'); });
  }

  function scorecardResult(d) {
    if (!d) return null;
    if (d.error) return ui.warning('Scorecard: ' + (d.error === 'not_found' ? 'no published scorecard for that repo.' : d.error), 'amber');
    return h('div', { class: 'rq-stack' },
      h('div', { class: 'rq-row' }, h('strong', null, d.repo), ui.badge('Score ' + num(d.score, 1) + ' / 10', tone(d.score)), d.date ? h('span', { class: 'rq-mono rq-muted' }, d.date) : null),
      ui.bars(d.checks.map((c) => [c.name, Math.max(0, c.score == null ? 0 : c.score), tone(c.score)]), { label: 'Scorecard checks' }),
      h('p', { class: 'rq-fineprint' }, 'OpenSSF Scorecard (ossf/scorecard). Automated signal, not an audit. Lowest-scoring checks first.'));
  }
  function osvResult(d) {
    if (!d) return null;
    if (d.error) return ui.warning('OSV: ' + (d.error === 'not_found' ? 'no record for that id.' : d.error), 'amber');
    return h('div', { class: 'rq-stack' },
      h('div', { class: 'rq-row' }, h('strong', null, d.id), ...(d.aliases || []).map((a) => ui.badge(a, 'neutral')), ...(d.severity || []).map((s) => ui.badge(s, 'warn'))),
      d.summary ? h('p', null, d.summary) : null,
      d.affected && d.affected.length ? h('p', { class: 'rq-fineprint' }, 'Affected: ' + d.affected.join(', ')) : null,
      h('p', null, extLink('https://osv.dev/vulnerability/' + d.id, 'Open on OSV.dev')));
  }

  function render() {
    if (!live()) {
      return h('div', null,
        ui.warning('Live intel needs the JAQA Node server (it fetches these APIs server-side). This looks like static-only hosting, so open the official sources directly:', 'amber'),
        h('ul', { class: 'rq-list' },
          h('li', null, extLink('https://www.cisa.gov/known-exploited-vulnerabilities-catalog', 'CISA KEV catalogue')),
          h('li', null, extLink('https://www.first.org/epss/', 'FIRST EPSS')),
          h('li', null, extLink('https://securityscorecards.dev/', 'OpenSSF Scorecard')),
          h('li', null, extLink('https://osv.dev/', 'OSV.dev'))));
    }
    const repoOk = /^[A-Za-z0-9][\w.-]*\/[\w.-]+$/.test(st.repo.trim());
    const vulnOk = /^(CVE-\d{4}-\d{4,7}|GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4})$/i.test(st.vuln.trim());
    return h('div', { class: 'rq-stack' },
      ui.moduleWarnings([
        'Live data from CISA, FIRST, OpenSSF and OSV via the JAQA server. Signals, not determinations: a high score or no record is not a guarantee.'
      ]),
      ui.section('Project security posture (OpenSSF Scorecard)', { icon: 'gauge', desc: 'Score any GitHub project in the Arsenal, e.g. sigstore/cosign.' },
        h('div', { class: 'rq-row rq-row-tight' },
          ui.input('owner/repo', st.repo, (v) => { st.repo = v; }, { key: 'intel-repo', placeholder: 'sigstore/cosign', cls: 'rq-field-inline', maxlength: 100 }),
          ui.button('Score it', () => repoOk && runScorecard(st.repo.trim()), { variant: 'primary', icon: 'gauge', cls: 'rq-btn-sm' })),
        scorecardResult(st.scorecard)),
      ui.section('Vulnerability lookup (OSV.dev)', { icon: 'bug', desc: 'Look up a CVE or GHSA id.' },
        h('div', { class: 'rq-row rq-row-tight' },
          ui.input('CVE / GHSA id', st.vuln, (v) => { st.vuln = v; }, { key: 'intel-osv', placeholder: 'CVE-2021-44228', cls: 'rq-field-inline', maxlength: 40 }),
          ui.button('Look up', () => vulnOk && runOsv(st.vuln.trim().toUpperCase()), { variant: 'primary', icon: 'search', cls: 'rq-btn-sm' })),
        osvResult(st.osv)),
      h('div', { class: 'rq-mon-grid' },
        feedPanel('kev', 'Actively exploited (CISA KEV)', 'cisagov/kev', kevList),
        feedPanel('epss-top', 'Highest exploitation probability (EPSS)', 'FIRST EPSS', epssList)),
      h('p', { class: 'rq-fineprint' }, 'Each source is an open-source project in the Arsenal, called server-side and cached. Nothing you type is logged. Licences for what JAQA ships: ', h('a', { href: '/licenses/' }, 'Licences'), '.'));
  }

  R.modules.register({
    id: 'intel',
    group: 'arsenal',
    order: 0,
    icon: 'bug',
    title: 'Arsenal · Live Intel',
    short: 'Arsenal · Live Intel',
    description: 'Live threat & vulnerability intelligence from Arsenal projects that expose public APIs: CISA KEV, FIRST EPSS, OpenSSF Scorecard and OSV.dev — fetched by the JAQA Node server.',
    warnings: [
      'Live signals from third-party public APIs via the JAQA server. Not a determination of risk, exploitability or safety; verify at the source.'
    ],
    liveRefresh: false,
    render
  });
})(window.JAQAWorkspace);
