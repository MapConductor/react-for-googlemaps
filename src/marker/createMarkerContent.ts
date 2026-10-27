/// <reference types="google.maps" />
import { markerHitShape, type BitmapIcon } from '@mapconductor/js-sdk-core';

/**
 * The part of the bitmap a click should hit, in the bitmap's own pixels: the
 * pin as drawn (and its label), from the core's `markerHitShape`. A default pin
 * is drawn about 31 px wide in a 48 px square bitmap.
 */
export function markerHitRectInBitmap(bitmapIcon: BitmapIcon): { left: number; top: number; width: number; height: number } {
  const shape = markerHitShape(bitmapIcon);
  return {
    left: bitmapIcon.anchor.x * bitmapIcon.size.width - shape.anchor.x * shape.width,
    top: bitmapIcon.anchor.y * bitmapIcon.size.height - shape.anchor.y * shape.height,
    width: shape.width,
    height: shape.height,
  };
}

/**
 * BitmapIcon の anchor を AdvancedMarkerElement の content 要素に反映する。
 *
 * AdvancedMarkerElement のデフォルトアンカーは bottom-center (ax=0.5, ay=1)。
 * BitmapIcon の anchor がそれと異なる場合は CSS transform で補正する。
 *
 * The image takes no pointer events; a transparent box over the drawn pin
 * does. A click on the rest of the bitmap then reaches the map underneath,
 * as if the marker were not there — gmp-click fires only on the pin.
 */
export function createMarkerContent(bitmapIcon: BitmapIcon): HTMLElement {
  const content = document.createElement('div');
  content.style.position = 'relative';
  content.style.width = `${bitmapIcon.size.width}px`;
  content.style.height = `${bitmapIcon.size.height}px`;
  content.style.pointerEvents = 'none';
  const tx = (0.5 - bitmapIcon.anchor.x) * 100;
  const ty = (1 - bitmapIcon.anchor.y) * 100;
  if (tx !== 0 || ty !== 0) {
    content.style.transform = `translate(${tx}%, ${ty}%)`;
  }

  const img = document.createElement('img');
  img.src = bitmapIcon.url;
  img.width = bitmapIcon.size.width;
  img.height = bitmapIcon.size.height;
  img.style.display = 'block';
  img.style.pointerEvents = 'none';
  content.appendChild(img);

  const rect = markerHitRectInBitmap(bitmapIcon);
  const hit = document.createElement('div');
  hit.style.position = 'absolute';
  hit.style.left = `${rect.left}px`;
  hit.style.top = `${rect.top}px`;
  hit.style.width = `${rect.width}px`;
  hit.style.height = `${rect.height}px`;
  hit.style.pointerEvents = 'auto';
  content.appendChild(hit);
  return content;
}

const HIT_SHAPED_CLASS = 'mc-hit-shaped';

/**
 * Lets only the drawn pin of an AdvancedMarkerElement take clicks.
 *
 * Google sets `pointer-events: auto` inline on the marker element itself (and
 * again whenever gmpClickable changes), so the whole bitmap-sized element
 * would still catch clicks around the content's hit box. A stylesheet rule
 * marked !important beats that inline value; the hit box inside, set to
 * `auto`, still takes the clicks meant for the pin, and they bubble to the
 * marker element as gmp-click.
 */
export function shapeMarkerHits(marker: HTMLElement): void {
  if (typeof document !== 'undefined' && !document.getElementById(HIT_SHAPED_CLASS)) {
    const style = document.createElement('style');
    style.id = HIT_SHAPED_CLASS;
    style.textContent = `.${HIT_SHAPED_CLASS} { pointer-events: none !important; }`;
    document.head.appendChild(style);
  }
  marker.classList.add(HIT_SHAPED_CLASS);
}
