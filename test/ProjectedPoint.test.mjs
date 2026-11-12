import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'tsup';

// 既定の地図タイプは EPSG:3857。アプリが投影を持つ地図タイプを登録して使うと、
// その投影のワールド座標（座標系の番号は無い）で返る。
mkdirSync(new URL('../build/', import.meta.url), { recursive: true });
const outDir = mkdtempSync(new URL('../build/projected-point-tests-', import.meta.url));
after(() => rmSync(outDir, { recursive: true, force: true }));
await build({
    entry: { holder: 'src/GoogleMapViewHolder2D.ts' },
    outDir, format: ['esm'], platform: 'node', splitting: false,
    dts: false, sourcemap: false, config: false, silent: true,
    external: ['@mapconductor/js-sdk-core'],
});

class LatLng {
    constructor(lat, lng) { this._lat = lat; this._lng = lng; }
    lat() { return this._lat; }
    lng() { return this._lng; }
}
class Point {
    constructor(x, y) { this.x = x; this.y = y; }
}
globalThis.google = { maps: { LatLng, Point } };

// Gall-Peters（Google のドキュメントにある独自投影の例）。256 x 256 のワールド。
const gallPeters = {
    fromLatLngToPoint(latLng) {
        const x = 128 + (latLng.lng() / 180) * 128;
        const y = 128 - Math.sin((latLng.lat() * Math.PI) / 180) * 128;
        return new Point(x, y);
    },
    fromPointToLatLng(point) {
        const lng = ((point.x - 128) / 128) * 180;
        const lat = (Math.asin((128 - point.y) / 128) * 180) / Math.PI;
        return new LatLng(lat, lng);
    },
};

const { GoogleMapViewHolder2D } = await import(pathToFileURL(resolve(outDir, 'holder.mjs')).href);
const { createGeoPoint, ProjectedUnit } = await import('@mapconductor/js-sdk-core');
const tokyo = createGeoPoint({ latitude: 35.681236, longitude: 139.767125 });

const holderWith = typeId => new GoogleMapViewHolder2D(null, {
    getMapTypeId: () => typeId,
    // Google の登録簿は既定の地図タイプにも Mercator の projection を持たせている。
    mapTypes: { get: id => ({ projection: id === 'gall-peters' ? gallPeters : { builtIn: true } }) },
});

test('built-in map types are EPSG:3857', () => {
    const holder = holderWith('roadmap');
    assert.equal(holder.coordinateSystem.code, 'EPSG:3857');
    const point = holder.toProjectedPoint(tokyo);
    assert.ok(Math.abs(point.x - 15558805.18) < 0.01, `x ${point.x}`);
});

test('a map type with its own projection reports engine units', () => {
    const holder = holderWith('gall-peters');
    assert.deepEqual(holder.coordinateSystem, { code: null, unit: ProjectedUnit.Other });
    const point = holder.toProjectedPoint(tokyo);
    assert.ok(Math.abs(point.x - (128 + (139.767125 / 180) * 128)) < 1e-9, `x ${point.x}`);
    const back = holder.fromProjectedPoint(point);
    assert.ok(Math.abs(back.latitude - tokyo.latitude) < 1e-9);
    assert.ok(Math.abs(back.longitude - tokyo.longitude) < 1e-9);
});
