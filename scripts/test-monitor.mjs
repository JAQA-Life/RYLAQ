#!/usr/bin/env node
/* Offline unit tests for the Global Monitor feed parsers (no network). */
import assert from 'node:assert/strict';
import { parseRss, parseEonet, parseGeojson, decode } from '../server/monitor.mjs';

const rss = `<?xml version="1.0"?><rss version="2.0" xmlns:georss="http://www.georss.org/georss"><channel><title>X</title>
<item><title><![CDATA[Flood alert &amp; evacuation <b>now</b>]]></title><link>https://example.org/a?x=1&amp;y=2</link>
<pubDate>Tue, 29 Sep 2026 10:00:00 GMT</pubDate><georss:point>12.5 -45.25</georss:point></item>
<item><title>No link item</title></item>
<item><title>Bad scheme</title><link>javascript:alert(1)</link></item>
<item><title>Entity &#8212; &#x2019;test&#39;</title><link>http://example.org/b</link></item></channel></rss>`;
const r = parseRss(rss);
assert.equal(r.length, 2, 'items without a safe link are dropped');
assert.equal(r[0].title, 'Flood alert & evacuation now');
assert.equal(r[0].link, 'https://example.org/a?x=1&y=2');
assert.equal(r[0].published, '2026-09-29T10:00:00.000Z');
assert.deepEqual([r[0].lat, r[0].lon], [12.5, -45.25]);
assert.equal(r[1].title, 'Entity — ’test\'');

const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title type="html">Advice &lt;updated&gt;</title>
<link rel="alternate" type="text/html" href="https://www.gov.uk/x"/><updated>2026-09-28T08:00:00Z</updated></entry></feed>`;
const a = parseRss(atom);
assert.equal(a.length, 1);
assert.equal(a[0].title, 'Advice <updated>'); // escaped markup stays literal text (rendered with textContent)
assert.equal(a[0].link, 'https://www.gov.uk/x');

const rdf = `<rdf:RDF><item rdf:about="https://e.org/1"><title>RDF item</title><link>https://e.org/1</link><dc:date>2026-09-01</dc:date></item></rdf:RDF>`;
assert.equal(parseRss(rdf)[0].title, 'RDF item');

const eo = parseEonet({ events: [{ title: 'Wildfire X', link: 'https://eonet.gsfc.nasa.gov/api/v3/events/E1', categories: [{ title: 'Wildfires' }], sources: [{ url: 'https://inciweb.example/1' }], geometry: [{ date: '2026-09-20T00:00:00Z', type: 'Point', coordinates: [-120.5, 38.1] }] }] });
assert.equal(eo[0].title, 'Wildfire X — Wildfires');
assert.equal(eo[0].link, 'https://inciweb.example/1');
assert.deepEqual([eo[0].lat, eo[0].lon], [38.1, -120.5]);

const gj = parseGeojson({ features: [{ properties: { title: 'M 6.1 - 10 km N of Y', url: 'https://earthquake.usgs.gov/e/1', time: 1790000000000 }, geometry: { coordinates: [140.1, 35.2, 10] } }] });
assert.equal(gj[0].title, 'M 6.1 - 10 km N of Y');
assert.deepEqual([gj[0].lat, gj[0].lon], [35.2, 140.1]);
assert.equal(parseGeojson({ features: [{ properties: { title: 'x', url: 'ftp://bad' } }] }).length, 0);
assert.equal(decode('&unknown; &lt;ok&gt;'), '&unknown; <ok>');
console.log('Monitor parser tests passed.');
