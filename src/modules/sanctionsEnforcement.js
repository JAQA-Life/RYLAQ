/*
 * sanctionsEnforcement.js — MODULE 8: Financial Crime, Sanctions &
 * Enforcement.
 *
 * HOW "NO HIT ≠ CLEAR" IS ENFORCED
 *   Sanctions and debarment sources are link-out only; JAQA never queries
 *   them automatically, never bulk-screens, and never renders words such as
 *   "cleared" or "no match — safe". Every sanctions panel carries the no-hit
 *   warning, and exports repeat it (R.exporters.DOMAIN_WARNINGS.sanctions).
 */
(function (R) {
  'use strict';
  const { h } = R.util;
  const ui = R.ui;

  R.modules.register({
    id: 'sanctions',
    group: 'finance',
    order: 24,
    icon: 'shield',
    title: 'Financial Crime, Sanctions & Enforcement',
    short: 'Sanctions & Enforcement',
    description: 'Official sanctions, debarment, export-control and enforcement sources (link-out), plus live regulatory notices and court records where verified.',
    warnings: [
      'No public match found does not mean cleared. JAQA is not an AML system and not a sanctions clearance tool. JAQA does not determine suspicion, intent, or liability.',
      'No SAR/CTR access, no transaction monitoring, no KYC document processing. JAQA does not assist sanctions or export-control evasion.'
    ],
    render(ctx) {
      const name = ctx.session ? (ctx.primary ? (ctx.primary.data && ctx.primary.data.name) || ctx.primary.title : ctx.q) : null;
      const isList = ctx.session && ['sanctionsId'].includes(ctx.type);
      return h(
        'div',
        null,
        ctx.session && ctx.type === 'person' ? ui.warning('Person searches are restricted. Use your organization’s screening system of record; JAQA does not aggregate personal data.', 'red') : null,
        ui.section('Sanctions lists (official, link-out)', { icon: 'shield', desc: 'Screen names in the official tools. Name matching requires fuzzy logic, identifiers and human adjudication.' }, ui.warning(R.legal.noHitNotClear, 'red', 'No hit ≠ clear.'), ui.linkouts(R.directories.sanctions.filter((e) => e.kind === 'sanctions'), null)),
        ui.section('Export control & forced-labour entity lists (link-out)', { icon: 'ship' }, ui.linkouts(R.directories.sanctions.filter((e) => e.kind === 'export-control'), null)),
        ui.section('Debarment & exclusions (link-out)', { icon: 'gavel' }, ui.linkouts(R.directories.sanctions.filter((e) => e.kind === 'debarment'), null)),
        ui.section('Enforcement & financial-crime sources (link-out)', { icon: 'doc' }, ui.dir('enforcement', null)),
        ctx.session
          ? ui.section('Recent US sanctions & export-control rules (Federal Register, live)', { icon: 'search', desc: isList ? 'Loaded automatically for sanctions concept searches.' : 'User-triggered.' }, ui.taskPanel(R.T.frSearch(isList && ctx.chosen.focus === 'sam' ? 'debarment' : 'sanctions', { perPage: 8, order: 'newest' }), { auto: isList, limit: 8 }))
          : null,
        name && !isList && ctx.type !== 'person'
          ? ui.section('Court records mentioning the subject (live, user-triggered)', { icon: 'gavel', desc: 'Text match only; may include unrelated parties. Not an adverse-media or enforcement determination.' }, ui.taskPanel(R.T.courts(name, 'o'), { limit: 8 }))
          : null,
        ui.section('Adverse media (link-out only)', { icon: 'globe' }, ui.warning('Media signals are noisy and unverified. JAQA does not perform adverse-media screening.', 'amber'), name && ctx.type !== 'person' ? ui.taskPanel(R.T.gdelt(name), { limit: 10 }) : null),
        ui.exportBar('JAQA-Sanctions-Enforcement-triage.json', 'JAQA-Sanctions-Enforcement-triage.csv', 'sanctions')
      );
    }
  });
})(window.JAQAWorkspace);
