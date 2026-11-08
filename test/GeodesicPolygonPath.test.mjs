import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'tsup';
import { createGeoPoint, Planar, WGS84Geodesic } from '@mapconductor/js-sdk-core';

// The polygon path handed to google.maps.Polygon (geodesic: false, densified
// by us). A geodesic ring must include its closing edge (last vertex -> first):
// Google draws fill and outline from the same path, so a missing closing edge
// leaves both of them a straight chord there.
mkdirSync(new URL('../build/', import.meta.url), { recursive: true });
const outDir = mkdtempSync(new URL('../build/geodesic-polygon-path-tests-', import.meta.url));
after(() => rmSync(outDir, { recursive: true, force: true }));
await build({
    entry: { overlay3d: 'src/overlay3d.ts' },
    outDir, format: ['esm'], platform: 'node', splitting: false,
    dts: false, sourcemap: false, config: false, silent: true,
    external: ['@mapconductor/js-sdk-core'],
});
const { buildPolygonPath } = await import(pathToFileURL(resolve(outDir, 'overlay3d.mjs')));

const p = (latitude, longitude) => createGeoPoint({ latitude, longitude });
const BOSTON = p(42.36, -71.06);
const LONDON = p(51.5, -0.12);
const ICELAND = p(64.1, -21.9);
const TRIANGLE = [BOSTON, LONDON, ICELAND];

test('a geodesic polygon path follows the great circle on its closing edge', () => {
    const path = buildPolygonPath(TRIANGLE, true);
    const expected = WGS84Geodesic.createInterpolatePoints([...TRIANGLE, BOSTON]).slice(0, -1);
    assert.equal(path.length, expected.length);
    path.forEach((q, i) => {
        assert.ok(Math.abs(q.lat - expected[i].latitude) < 1e-9 && Math.abs(q.lng - expected[i].longitude) < 1e-9, `point ${i}`);
    });
    // Iceland -> Boston passes 55.6N at 53.2W (the straight chord passes 51.6N).
    const mid = WGS84Geodesic.interpolate({ from: ICELAND, to: BOSTON, fraction: 0.5 });
    const nearest = Math.min(...path.map((q) => Math.hypot(q.lat - mid.latitude, q.lng - mid.longitude)));
    assert.ok(nearest < 0.1, `nearest ${nearest}`);
});

test('a non-geodesic polygon path is unchanged', () => {
    const path = buildPolygonPath(TRIANGLE, false);
    const expected = Planar.createInterpolatePoints(TRIANGLE);
    assert.equal(path.length, expected.length);
    const last = path[path.length - 1];
    assert.ok(last.lat === ICELAND.latitude && last.lng === ICELAND.longitude);
});
