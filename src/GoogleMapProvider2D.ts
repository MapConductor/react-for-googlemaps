import { setOptions } from '@googlemaps/js-api-loader';
import { MapProvider, type MapViewControllerInterface } from '@mapconductor/js-sdk-core';
import { geoPointToLatLngAltitude } from './GeoPoint';
import { GoogleMapCircleController } from './circle/GoogleMapCircleController';
import { GoogleMapGroundImageController } from './groundimage/GoogleMapGroundImageController';
import { GoogleMapAdvancedMarkerElementRenderer2D } from './marker/GoogleMapAdvancedMarkerElementRenderer2D';
import { GoogleMapMarkerController2D } from './marker/GoogleMapMarkerController2D';
import { GoogleMapPolygonController } from './polygon/GoogleMapPolygonController';
import { GoogleMapPolylineController } from './polyline/GoogleMapPolylineController';
import { GoogleMapRasterLayerController } from './raster/GoogleMapRasterLayerController';
import { hasLibrary, loadLibrary } from './LibraryLoader';
import { GoogleMapConfig2D } from './GoogleMapConfig';
import { GoogleMapViewHolder2D } from './GoogleMapViewHolder2D';
import { GoogleMapGroundImageOverlayRenderer2D } from './groundimage/GoogleMapGroundImageOverlayRenderer2D';
import { GoogleMapPolygonOverlayRenderer2D } from './polygon/GoogleMapPolygonOverlayRenderer2D';
import { GoogleMapPolylineOverlayRenderer2D } from './polyline/GoogleMapPolylineOverlayRenderer2D';
import { GoogleMapCircleOverlayRenderer2D } from './circle/GoogleMapCircleOverlayRenderer2D';
import { GoogleMapRasterLayerOverlayRenderer2D } from './raster/GoogleMapRasterLayerOverlayRenderer2D';
import { GoogleMapMarkerRenderer2D } from './marker/GoogleMapMarkerRenderer2D';
import { GoogleMapViewController2D } from './GoogleMapViewController2D';

/**
 * Google Maps provider implementation
 */
export class GoogleMapProvider2D extends MapProvider {

  async initialize(config: GoogleMapConfig2D): Promise<MapViewControllerInterface> {


    // Initialize Google Maps API
    if (!hasLibrary('maps3d') && !hasLibrary('maps')) {
      setOptions({
        key: config.apiKey,
      });
    }
    setOptions({
      v: config.version,
        libraries: Array.from(new Set(config.libraries)),
    });

    const { Map } = await loadLibrary<google.maps.MapsLibrary>('maps');

    // Re-check after await: prevents StrictMode double-init where both calls
    // pass the first guard before either completes the async work.
    if (this.controller) {
      return this.controller;
    }

    // Get or create container element
    const container =
      typeof config.container === 'string'
        ? document.getElementById(config.container)
        : config.container;

    if (!container) {
      throw new Error('Container element not found');
    }

    // Create Google Maps instance
    const map = new Map(container, {
      zoom: config.initCameraPosition?.zoom || 2,
      center: geoPointToLatLngAltitude(config.initCameraPosition?.center || null) || { lat: 0, lng: 0 },
      mapId: config.mapId,
      mapTypeId: config.mapDesignType,
      ...config.options,
    });

    const holder = new GoogleMapViewHolder2D(container, map);
    const markerController = getMarkerController(holder, config);
    const circleController = getCircleController(holder);
    const polylineController = getPolylineController(holder);
    const polygonController = getPolygonController(holder);
    const groundImageController = getGroundImageController(holder);
    const rasterLayerController = getRasterLayerController(holder);

    // Create controller
    this.controller = new GoogleMapViewController2D(
      holder,
      markerController,
      circleController,
      polylineController,
      polygonController,
      groundImageController,
      rasterLayerController,
    );

    return this.controller;
  }

  destroy(): void {
    if (this.controller) {
      this.controller.destroy();
      this.controller = null;
    }
  }
}

function getRasterLayerController(holder: GoogleMapViewHolder2D): GoogleMapRasterLayerController {
  const renderer = new GoogleMapRasterLayerOverlayRenderer2D(holder);
  return new GoogleMapRasterLayerController(
    renderer,
  );
}

function getMarkerController(holder: GoogleMapViewHolder2D, config: GoogleMapConfig2D): GoogleMapMarkerController2D {
  const markerRenderer = config.mapId ? new GoogleMapAdvancedMarkerElementRenderer2D(holder) : new GoogleMapMarkerRenderer2D(holder);
  return new GoogleMapMarkerController2D(markerRenderer, config.markerTilingOptions);
}

function getCircleController(holder: GoogleMapViewHolder2D): GoogleMapCircleController {
  const renderer = new GoogleMapCircleOverlayRenderer2D(holder);
  return new GoogleMapCircleController(renderer);
}
function getPolylineController(holder: GoogleMapViewHolder2D): GoogleMapPolylineController {
  const renderer = new GoogleMapPolylineOverlayRenderer2D(holder);
  return new GoogleMapPolylineController(renderer);
}
function getPolygonController(holder: GoogleMapViewHolder2D): GoogleMapPolygonController {
  const renderer = new GoogleMapPolygonOverlayRenderer2D(holder);
  return new GoogleMapPolygonController(renderer);
}
function getGroundImageController(holder: GoogleMapViewHolder2D): GoogleMapGroundImageController {
  const renderer = new GoogleMapGroundImageOverlayRenderer2D(holder);
  return new GoogleMapGroundImageController(renderer);
}
