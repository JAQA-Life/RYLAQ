/*
 * JAQA Arsenal — live intelligence sources ("rewrapped for the Node app").
 *
 * These are the Arsenal projects that expose a PUBLIC, KEYLESS data API the JAQA
 * Node server can call server-side and re-serve same-origin at /api/jaqa/intel/*.
 * Everything else in the Arsenal is a full platform / library and stays
 * link-out only. A source is served ONLY after scripts/verify-intel.mjs has
 * fetched it successfully from an open-network runner and recorded that in
 * config/intel-verification.json (same model as the Global Monitor).
 *
 * No keys, no visitor data upstream, no logging. Hosts are allowlisted here and
 * nowhere else; lookup inputs are strictly validated in server/intel.mjs.
 * JAQA™ is a trademark of JAQA. © JAQA™. Licensed under AGPL-3.0-or-later.
 */
export const CATEGORIES = [
  ['exploited', 'Actively exploited'],
  ['vuln', 'Vulnerability intelligence'],
  ['posture', 'Project security posture']
];

/*
 * kind 'feed'   → periodic list the server caches and serves (GET .../feed?id=)
 * kind 'lookup' → user supplies a strictly-validated id/repo (GET .../lookup?id=)
 * `format` selects the parser in server/intel.mjs. `probe` is the fixed URL the
 * verifier hits (never carries user input). `repo` ties the source to its
 * Arsenal entry so the UI can cross-link.
 */
export const SOURCES = [
  {
    id: 'kev',
    name: 'CISA Known Exploited Vulnerabilities',
    repo: 'cisagov/kev-data',
    home: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
    category: 'exploited',
    kind: 'feed',
    format: 'kev',
    host: 'www.cisa.gov',
    url: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
    probe: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
    note: 'Vulnerabilities CISA has confirmed are being exploited in the wild.'
  },
  {
    id: 'epss-top',
    name: 'FIRST EPSS — highest exploitation probability',
    repo: 'FIRSTdotorg/epss-data-api',
    home: 'https://www.first.org/epss/',
    category: 'vuln',
    kind: 'feed',
    format: 'epss',
    host: 'api.first.org',
    url: 'https://api.first.org/data/v1/epss?order=!epss&limit=30',
    probe: 'https://api.first.org/data/v1/epss?order=!epss&limit=1',
    note: 'CVEs ranked by Exploit Prediction Scoring System probability.'
  },
  {
    id: 'scorecard',
    name: 'OpenSSF Scorecard — project security posture',
    repo: 'ossf/scorecard',
    home: 'https://securityscorecards.dev/',
    category: 'posture',
    kind: 'lookup',
    format: 'scorecard',
    host: 'api.securityscorecards.dev',
    input: 'repo', // owner/repo
    url: (repo) => 'https://api.securityscorecards.dev/projects/github.com/' + repo,
    probe: 'https://api.securityscorecards.dev/projects/github.com/sigstore/cosign',
    note: 'Automated security-health score (0–10) for any GitHub project.'
  },
  {
    id: 'osv',
    name: 'OSV.dev — open-source vulnerability record',
    repo: 'google/osv-scanner',
    home: 'https://osv.dev/',
    category: 'vuln',
    kind: 'lookup',
    format: 'osv',
    host: 'api.osv.dev',
    input: 'vulnId', // e.g. GHSA-… or CVE-…
    url: (id) => 'https://api.osv.dev/v1/vulns/' + id,
    probe: 'https://api.osv.dev/v1/vulns/GHSA-jfh8-c2jp-5v3q',
    note: 'Look up a single vulnerability by OSV / GHSA / CVE id.'
  }
];

export const byId = (id) => SOURCES.find((s) => s.id === id) || null;
