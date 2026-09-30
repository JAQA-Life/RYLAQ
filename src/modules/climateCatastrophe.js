/*
 * climateCatastrophe.js — MODULE 14: Physical, Climate & Catastrophe
 * Disruption.
 *
 * Event context is anchored to a reference point (a resolved place, port or
 * a country capital). No map tiles are loaded. Proximity is computed by RYLAQ
 * (haversine) and labeled as derived.
 */
(function (R) {
  'use strict';
  const { h, extLink } = R.util;
  const ui = R.ui;
  const T = R.T;

  const local = { place: '' };
  R.events.on('session:cleared', () => (local.place = ''));

  // Local event globe (shares the Situation Room globe engine).
  let localGlobe = null;
  function localPoints(r) {
    const pts = [{ kind: 'entity', lat: r.lat, lon: r.lon, label: 'Reference point · ' + (r.placeLabel || 'resolved location') }];
    const q = R.tasks.get(T.quakes(r.lat, r.lon, 500, 30).key);
    (q && q.records ? q.records : []).forEach((x) => isFinite(x.data.lat) && pts.push({ kind: 'quake', lat: x.data.lat, lon: x.data.lon, weight: Math.max(0, Math.min(1, ((x.data.mag || 4.5) - 4.5) / 3)), label: x.title, record: x }));
    const f = R.tasks.get(T.forecast(r.lat, r.lon, r.placeLabel).key);
    if (f && f.records && f.records[0] && f.records[0].data.flags.length) pts.push({ kind: 'signal', lat: r.lat + 0.6, lon: r.lon + 0.6, label: 'Forecast threshold signal · ' + f.records[0].data.flags[0], record: f.records[0] });
    return pts;
  }
  R.events.on('task:update', (t) => {
    const s = R.state.session;
    if (!localGlobe || !s || !/^(usgs:|om:fc:)/.test(t.key) || s.resolved.lat === undefined || s.resolved.lat === null) return;
    localGlobe.setPoints(localPoints(s.resolved));
  });

  function placePicker(ctx) {
    const s = ctx.session;
    let val = local.place;
    const form = h(
      'form',
      { class: 'rq-inline-form', onsubmit: (e) => {
        e.preventDefault();
        const chk = R.privacy.checkInput(val);
        if (!chk.ok) return R.util.announce(chk.reason);
        local.place = chk.value;
        R.shell.refresh();
      } },
      ui.input('Reference place (city, port or region — never a private address)', val, (v) => (val = v), { placeholder: 'e.g. Kaohsiung, Rotterdam, Houston', key: 'climate-place' }),
      h('button', { type: 'submit', class: 'rq-btn rq-btn-primary' }, 'Resolve place')
    );
    const panel = local.place
      ? ui.taskPanel(T.geocode(local.place), { auto: true, limit: 5, noHitWarning: false, onSelect: (r) => {
          Object.assign(s.resolved, { lat: r.data.lat, lon: r.data.lon, placeLabel: r.title, iso2: s.resolved.iso2 || r.data.country });
          R.shell.refresh();
        }, selectLabel: 'Use as reference point' })
      : null;
    return h('div', null, form, panel);
  }

  R.modules.register({
    id: 'climate',
    group: 'risk',
    order: 11,
    icon: 'cloud',
    title: 'Physical, Climate & Catastrophe Disruption',
    short: 'Climate & Catastrophe',
    description: 'Earthquakes, weather forecasts and official alerts near a reference point, plus climate-vulnerability and catastrophe-loss link-outs.',
    warnings: ['Public event data does not confirm insured loss, supplier disruption, contract force majeure, or claims liability.', 'Facility proximity requires verified addresses and may be incomplete. No map tiles are loaded.'],
    liveRefresh: false,
    render(ctx) {
      if (!ctx.session) return h('div', null, ui.needSession('event signals'), ui.dir('climate', null, { title: 'Official climate & catastrophe sources' }));
      const r = ctx.resolved;
      const hasPoint = r.lat !== undefined && r.lat !== null && r.lon !== undefined && r.lon !== null;
      const isUS = r.iso2 === 'US' || r.iso2 === 'PR';
      const iso3 = R.countryFromCtx(ctx);
      return h(
        'div',
        null,
        ui.section('Reference point', { icon: 'globe' }, hasPoint ? h('p', null, ui.badge('Reference point', 'neutral'), ' ', r.placeLabel || `${r.lat}, ${r.lon}`, h('span', { class: 'rq-muted' }, ` (${Number(r.lat).toFixed(3)}, ${Number(r.lon).toFixed(3)})`)) : ui.warning('No reference point yet. Search a port, place or country, or resolve a place below.', 'info'), !hasPoint && iso3 ? ui.button('Use jurisdiction capital (' + iso3 + ') as approximate reference point', () => {
          const d = T.wbCountry(iso3);
          R.tasks.ensure(d);
          R.tasks.start(d.key);
        }, { icon: 'globe', cls: 'rq-btn-sm' }) : null, placePicker(ctx)),
        hasPoint
          ? h(
              'div',
              null,
              ui.section('Local event globe', { icon: 'globe', desc: 'Reference point, nearby M4.5+ events and forecast signals. Drag to rotate; select a marker for details. Positions are not facility or loss data.' }, (() => {
                const host = h('div', { class: 'rq-local-globe' });
                setTimeout(() => {
                  if (!host.isConnected) return;
                  if (localGlobe) localGlobe.destroy();
                  localGlobe = R.situation.mountGlobe(host, localPoints(r), { lat: r.lat, lon: r.lon });
                }, 0);
                return host;
              })()),
              ui.section('Seismic events (USGS, M4.5+, 500 km, 30 days)', { icon: 'warn' }, ui.taskPanel(T.quakes(r.lat, r.lon, 500, 30), { auto: true, limit: 10, emptyText: 'No M4.5+ earthquakes within 500 km in the last 30 days.', noHitWarning: false })),
              ui.section('Weather forecast & threshold signals (Open-Meteo)', { icon: 'cloud' }, ui.taskPanel(T.forecast(r.lat, r.lon, r.placeLabel), { auto: true })),
              isUS ? ui.section('Official NWS alerts', { icon: 'warn' }, ui.taskPanel(T.nws(r.lat, r.lon), { auto: true, emptyText: 'No active NWS alerts for this point.', noHitWarning: false })) : ui.warning('Official NWS alerts cover the US only. Use national meteorological services (via WMO) elsewhere.', 'info'),
              ui.section('Mapped port & harbour features nearby (OpenStreetMap)', { icon: 'ship', desc: 'User-triggered, small query. Community-mapped; not a facility register.' }, ui.taskPanel(T.overpass(r.lat, r.lon), { limit: 10, noHitWarning: false, linkout: { href: `https://www.openstreetmap.org/#map=12/${r.lat}/${r.lon}`, label: 'Open OpenStreetMap at this point' } }))
            )
          : null,
        ui.section('Humanitarian & disaster reports (link-out)', { icon: 'link', desc: 'ReliefWeb API requires an approved appname; link-out until verified.' }, iso3 ? extLink('https://reliefweb.int/country/' + iso3.toLowerCase(), 'ReliefWeb country page') : null),
        ui.section('Climate vulnerability & catastrophe resources (link-out)', { icon: 'link' }, ui.dir('climate', null, { compact: true })),
        ui.exportBar('RYLAQ-Climate-Catastrophe-signals.json', 'RYLAQ-Climate-Catastrophe-signals.csv', 'globalRisk')
      );
    }
  });
})(window.RYLAQWorkspace);
