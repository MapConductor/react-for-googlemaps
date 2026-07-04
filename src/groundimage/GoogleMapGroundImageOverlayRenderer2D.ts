/// <reference types="google.maps" />
import {
  AbstractGroundImageOverlayRenderer,
  type GroundImageEntity,
  type GroundImageState,
} from '@mapconductor/js-sdk-core';
import { geoRectToLatLngBounds } from '../helpers';
import { GoogleMapViewHolder2D } from '../GoogleMapViewHolder2D';

export class GoogleMapGroundImageOverlayRenderer2D extends AbstractGroundImageOverlayRenderer<
  GoogleMapViewHolder2D,
  google.maps.GroundOverlay
> {
  constructor(holder: GoogleMapViewHolder2D) {
    super(holder);
  }

  async createGroundImage(state: GroundImageState): Promise<google.maps.GroundOverlay | null> {
    const bounds = geoRectToLatLngBounds(state.bounds);
    if (!bounds) return null;
    return new google.maps.GroundOverlay(state.imageUrl, bounds, {
      clickable: true,
      opacity: state.opacity,
      map: this.holder.map,
    });
  }

  async updateGroundImageProperties({
    groundImage,
    current,
    prev,
  }: {
    groundImage: google.maps.GroundOverlay;
    current: GroundImageEntity<google.maps.GroundOverlay>;
    prev: GroundImageEntity<google.maps.GroundOverlay>;
  }): Promise<google.maps.GroundOverlay | null> {
    // GroundOverlay doesn't support updating URL/bounds — recreate
    await this.removeGroundImage({ groundImage, state: prev.state, fingerPrint: prev.fingerPrint });
    return this.createGroundImage(current.state);
  }

  async removeGroundImage(entity: GroundImageEntity<google.maps.GroundOverlay>): Promise<void> {
    google.maps.event.clearInstanceListeners(entity.groundImage);
    entity.groundImage.setMap(null);
  }
}
