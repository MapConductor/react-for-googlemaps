import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'tsup';

// The tile templates Google Maps turns into LocalTileServer data URLs when
// there is no Service Worker. `@2x` asks for a tile drawn at two device pixels
// per CSS pixel, as in the Service Worker's URLs; without it the tile is 1x,
// as before.
mkdirSync(new URL('../build/', import.meta.url), { recursive: true });
const outDir = mkdtempSync(new URL('../build/local-tile-url-tests-', import.meta.url));
after(() => rmSync(outDir, { recursive: true, force: true }));
await build({
    entry: { url: 'src/raster/localTileUrl.ts' },
    outDir, format: ['esm'], platform: 'node', splitting: false,
    dts: false, sourcemap: false, config: false, silent: true,
    external: ['@mapconductor/js-sdk-core'],
});
const { localTileUrlTemplate, parseLocalTileTemplate } = await import(pathToFileURL(resolve(outDir, 'url.mjs')));

test('1x tiles keep the URLs they always had', () => {
    const template = localTileUrlTemplate({ routeId: 'mc-tile-a', tileSize: 256, cacheKey: '3' });
    assert.equal(template, 'mc-local-tile://mc-tile-a/256/3/{z}/{x}/{y}.png');
    assert.deepEqual(parseLocalTileTemplate(template), { routeId: 'mc-tile-a', tileSize: 256, pixelRatio: 1 });
});

test('a 2x tile says so in its URL and the map type reads it back', () => {
    const template = localTileUrlTemplate({ routeId: 'mc-tile-a', tileSize: 256, cacheKey: '3', pixelRatio: 2 });
    assert.equal(template, 'mc-local-tile://mc-tile-a/256/3/{z}/{x}/{y}@2x.png');
    assert.deepEqual(parseLocalTileTemplate(template), { routeId: 'mc-tile-a', tileSize: 256, pixelRatio: 2 });
    assert.equal(localTileUrlTemplate({ routeId: 'r', tileSize: 256, pixelRatio: 2 }),
        'mc-local-tile://r/256/{z}/{x}/{y}@2x.png');
});

test('Service Worker and other templates are loaded as plain URLs', () => {
    assert.equal(parseLocalTileTemplate('/__tiles/mc-tile-a/256/3/{z}/{x}/{y}@2x.png'), null);
    assert.equal(parseLocalTileTemplate('https://tile.openstreetmap.org/{z}/{x}/{y}.png'), null);
});
