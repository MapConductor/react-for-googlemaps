import { APIOptions, setOptions } from '@googlemaps/js-api-loader';
import { MapProvider, type GeoRectBounds, type MapViewControllerInterface } from '@mapconductor/js-sdk-core';
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
import { GoogleMapConfig } from './GoogleMapConfig';
import { GoogleMapMarkerRenderer } from './marker/GoogleMapMarkerRenderer';
import { ZoomAltitudeConverter } from './zoom';

function toLatLngBoundsLiteral(bounds: GeoRectBounds | undefined): google.maps.LatLngBoundsLiteral | undefined {
  if (!bounds?.southWest || !bounds.northEast) return undefined;
  return {
    south: bounds.southWest.latitude,
    west: bounds.southWest.longitude,
    north: bounds.northEast.latitude,
    east: bounds.northEast.longitude,
  };
}

/**
 * Google Maps provider implementation
 */
export class GoogleMapProvider extends MapProvider {
  private resizeObserver: ResizeObserver | null = null;

  async initialize(config: GoogleMapConfig): Promise<MapViewControllerInterface> {


    const version = config.mapDesignType?.toUpperCase() === 'ROADMAP' ? 'alpha' : config.version;
    const options: APIOptions = {
        v: version,
        libraries: Array.from(new Set(config.libraries)),
      };

    // Initialize Google Maps API
    // console.log(`maps3d: ${hasLibrary('maps3d')}, maps: ${hasLibrary('maps')}`);
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

    const viewportSize = () => {
      const rect = container.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    };
    // Map3DElement uses a physical camera range while MapConductor zoom follows
    // a screen-space scale. Normalize the calibrated range by viewport height,
    // as android-for-arcgis does for SceneView camera altitude.
    const zoomConverter = new ZoomAltitudeConverter(
      ZoomAltitudeConverter.DEFAULT_ZOOM0_ALTITUDE - 37_500_000,
      viewportSize,
    );

    // Create Google Maps instance.
    // Oblique camera semantics: initCameraPosition.position is the ground point
    // at screen center, so apply it via center/range/tilt (orbit model) — never
    // via cameraPosition, which would treat it as the camera's own location.
    const initCameraOptions = zoomConverter.mapCameraPositionToCameraOptions(config.initCameraPosition ?? null);
    // maxAltitude/minAltitude restrict how far the camera can zoom out/in;
    // there is no single "current latitude" before the map exists, so use the
    // initial camera's latitude (falls back to the equator) as the reference
    // for the cos(latitude) ground-resolution correction — an approximation,
    // same tradeoff ArcGIS/Cesium make for their zoom<->altitude conversions.
    const referenceLatitude = config.initCameraPosition?.position.latitude ?? 0;
    const map = new Map3DElement({
      ...(initCameraOptions ?? {
        center: { lat: 0, lng: 0, altitude: 0 },
        range: zoomConverter.zoomLevelToDistance({ zoomLevel: 1, latitude: 0 }),
        tilt: 0,
        heading: 0,
      }),
      mapId: config.mapId, // Styles are associated with map IDs.
      mode: config.mapDesignType,
      minAltitude: config.maxZoom !== undefined
        ? zoomConverter.zoomLevelToAltitude({ zoomLevel: config.maxZoom, latitude: referenceLatitude, tilt: 0 })
        : undefined,
      maxAltitude: config.minZoom !== undefined
        ? zoomConverter.zoomLevelToAltitude({ zoomLevel: config.minZoom, latitude: referenceLatitude, tilt: 0 })
        : undefined,
      bounds: toLatLngBoundsLiteral(config.restrictBounds),
      ...config.options,
    });
    Object.assign(map.style, { width: '100%', height: '100%', display: 'block' });
    container.innerHTML = '';
    container.appendChild(map);

    let previousHeight = viewportSize().height;
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        const nextHeight = viewportSize().height;
        if (nextHeight <= 0 || nextHeight === previousHeight) return;

        const range = map.range;
        if (range != null) {
          const previousEffectiveHeight = previousHeight > 0
            ? previousHeight
            : ZoomAltitudeConverter.REFERENCE_VIEWPORT_HEIGHT_PX;
          map.range = range * (nextHeight / previousEffectiveHeight);
        }
        previousHeight = nextHeight;
      });
      this.resizeObserver.observe(container);
    }

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
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
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
  config: GoogleMapConfig,
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
