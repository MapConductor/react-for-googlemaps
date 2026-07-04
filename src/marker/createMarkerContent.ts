/// <reference types="google.maps" />
import { type BitmapIcon } from '@mapconductor/js-sdk-core';

/**
 * BitmapIcon の anchor を AdvancedMarkerElement の content 要素に反映する。
 *
 * AdvancedMarkerElement のデフォルトアンカーは bottom-center (ax=0.5, ay=1)。
 * BitmapIcon の anchor がそれと異なる場合は CSS transform で補正する。
 */
export function createMarkerContent(bitmapIcon: BitmapIcon): HTMLElement {
  const img = document.createElement('img');
  img.src = bitmapIcon.url;
  img.width = bitmapIcon.size.width;
  img.height = bitmapIcon.size.height;
  img.style.display = 'block';
  const tx = (0.5 - bitmapIcon.anchor.x) * 100;
  const ty = (1 - bitmapIcon.anchor.y) * 100;
  if (tx !== 0 || ty !== 0) {
    img.style.transform = `translate(${tx}%, ${ty}%)`;
  }
  return img;
}