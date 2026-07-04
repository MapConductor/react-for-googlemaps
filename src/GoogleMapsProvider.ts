import { APIOptions, setOptions } from '@googlemaps/js-api-loader';
import { MapProvider, type MapViewControllerInterface } from '@mapconductor/js-sdk-core';
import { GoogleMapViewController } from './GoogleMapViewController';
import { GoogleMapViewHolder } from './GoogleMapViewHolder';
import { GoogleMapCircleController } from './circle/GoogleMapCircleController';
import { GoogleMapGroundImageController } from './groundimage/GoogleMapGroundImageController';
import { GoogleMapMarkerController } from './marker/GoogleMapMarkerController';
import { GoogleMapPolygonController } from './polygon/GoogleMapPolygonController';
import { GoogleMapPolylineController } from './polyline/GoogleMapPolylineController';
import { GoogleMapRasterLayerController } from './raster/GoogleMapRasterLayerController';
import { hasLibrary, loadLibrary } from './LibraryLoader';
import { GoogleMapRasterLayerOverlayRenderer } from './raster/GoogleMapRasterLayerOverlayRenderer';
import { GoogleMapGroundImageOverlayRenderer } from './groundimage/GoogleMapGroundImageOverlayRenderer';
import { GoogleMapPolygonOverlayRenderer } from './polygon/GoogleMapPolygonOverlayRenderer';
import { GoogleMapPolylineOverlayRenderer } from './polyline/GoogleMapPolylineOverlayRenderer';
import { GoogleMapCircleOverlayRenderer } from './circle/GoogleMapCircleOverlayRenderer';
import { GoogleMapsConfig } from './GoogleMapsConfig';
import { GoogleMapMarkerRenderer } from './marker/GoogleMapMarkerRenderer';
import { ZoomAltitudeConverter } from './zoom';

/**
 * Google Maps provider implementation
 */
export class GoogleMapsProvider extends MapProvider {
  
  async initialize(config: GoogleMapsConfig): Promise<MapViewControllerInterface> {


    const version = config.mapDesignType?.toUpperCase() === 'ROADMAP' ? 'alpha' : config.version;
    const options: APIOptions = {
        v: version,
        libraries: config.libraries
      };

    // Initialize Google Maps API
    console.log(`maps3d: ${hasLibrary('maps3d')}, maps: ${hasLibrary('maps')}`);
    if (!hasLibrary('maps3d') && !hasLibrary('maps')) {
      options.key = config.apiKey;
      setOptions(options);
    }

    const { Map3DElement } = await loadLibrary<google.maps.Maps3DLibrary>('maps3d');

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

    // Calibration zoom level by hand (using binary search)
    const ADJUST_ZOOM_ALTITUDE = -45000000;
    const zoomConverter = new ZoomAltitudeConverter(ZoomAltitudeConverter.DEFAULT_ZOOM0_ALTITUDE + ADJUST_ZOOM_ALTITUDE);

    // Create Google Maps instance
    const map = new Map3DElement({
      cameraPosition: zoomConverter.mapCameraPositionToLatLngAltitude(config.initCameraPosition) || { lat: 0, lng: 0, altitude: 0 },
      heading: config.initCameraPosition?.bearing ?? 0,
      tilt: config.initCameraPosition?.pitch ?? 45,
      mapId: config.mapId, // Styles are associated with map IDs.
      mode: config.mapDesignType,
      ...config.options,
    });
    Object.assign(map.style, { width: '100%', height: '100%', display: 'block' });
    container.innerHTML = '';
    container.appendChild(map);

    const holder = new GoogleMapViewHolder(container, map, zoomConverter);
    const markerController = getMarkerController(holder, config);
    const circleController = getCircleController(holder);
    const polylineController = getPolylineController(holder);
    const polygonController = getPolygonController(holder);
    const groundImageController = getGroundImageController(holder);
    const rasterLayerController = getRasterLayerController(holder);

    // Create controller
    this.controller = new GoogleMapViewController(
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

function getRasterLayerController(holder: GoogleMapViewHolder): GoogleMapRasterLayerController {
  const renderer = new GoogleMapRasterLayerOverlayRenderer(holder);
  return new GoogleMapRasterLayerController(
    renderer,
  );
}

function getMarkerController(
  holder: GoogleMapViewHolder,
  config: GoogleMapsConfig,
): GoogleMapMarkerController {
  const markerRenderer = new GoogleMapMarkerRenderer(holder);
  return new GoogleMapMarkerController(markerRenderer, config.markerTilingOptions);
}

function getCircleController(holder: GoogleMapViewHolder): GoogleMapCircleController {
  const renderer = new GoogleMapCircleOverlayRenderer(holder);
  return new GoogleMapCircleController(renderer);
}
function getPolylineController(holder: GoogleMapViewHolder): GoogleMapPolylineController {
  const renderer = new GoogleMapPolylineOverlayRenderer(holder);
  return new GoogleMapPolylineController(renderer);
}
function getPolygonController(holder: GoogleMapViewHolder): GoogleMapPolygonController {
  const renderer = new GoogleMapPolygonOverlayRenderer(holder);
  return new GoogleMapPolygonController(renderer);
}
function getGroundImageController(holder: GoogleMapViewHolder): GoogleMapGroundImageController {
  const renderer = new GoogleMapGroundImageOverlayRenderer(holder);
  return new GoogleMapGroundImageController(renderer);
}
