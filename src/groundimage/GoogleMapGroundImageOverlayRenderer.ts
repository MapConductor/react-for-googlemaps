/// <reference types="google.maps" />
import {
  AbstractGroundImageOverlayRenderer,
  type GroundImageEntity,
  type GroundImageState,
} from '@mapconductor/js-sdk-core';
// import { latLngBoundsLiteralFromGeoRect } from '../helpers';
import { GoogleMapViewHolder } from '../GoogleMapViewHolder';

export class GoogleMapGroundImageOverlayRenderer extends AbstractGroundImageOverlayRenderer<
  GoogleMapViewHolder,
  google.maps.GroundOverlay
> {
  constructor(holder: GoogleMapViewHolder) {
    super(holder);
  }

  async createGroundImage(_state: GroundImageState): Promise<google.maps.GroundOverlay | null> {
    return null;
    // const bounds = latLngBoundsLiteralFromGeoRect(state.bounds);
    // if (!bounds) return null;
    // return new google.maps.GroundOverlay(state.imageUrl, bounds, {
    //   clickable: true,
    //   opacity: state.opacity,
    //   map: this.holder.map,
    // });
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
