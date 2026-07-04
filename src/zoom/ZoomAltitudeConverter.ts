import { AbstractZoomAltitudeConverter, MapCameraPosition } from '@mapconductor/js-sdk-core';

export class ZoomAltitudeConverter extends AbstractZoomAltitudeConverter {
    private cosLatitudeFactor(latitude: number): number {
        const clamped = Math.max(-85, Math.min(85, latitude));
        const latRad = (clamped * Math.PI) / 180;
        return Math.max(AbstractZoomAltitudeConverter.MIN_COS_LAT, Math.abs(Math.cos(latRad)));
    }

    private cosTiltFactor(tilt: number): number {
        const clamped = Math.max(0, Math.min(90, tilt));
        const tiltRad = (clamped * Math.PI) / 180;
        return Math.max(AbstractZoomAltitudeConverter.MIN_COS_TILT, Math.cos(tiltRad));
    }

    zoomLevelToAltitude({
        zoomLevel,
        latitude,
        tilt,
    }: {
        zoomLevel: number;
        latitude: number;
        tilt: number;
    }): number {
        const clampedZoom = Math.min(Math.max(zoomLevel, AbstractZoomAltitudeConverter.MIN_ZOOM_LEVEL), AbstractZoomAltitudeConverter.MAX_ZOOM_LEVEL);
        const cosLat = this.cosLatitudeFactor(latitude);
        const cosTilt = this.cosTiltFactor(tilt);
        const distance = (this.zoom0Altitude * cosLat) / Math.pow(AbstractZoomAltitudeConverter.ZOOM_FACTOR, clampedZoom);
        const altitude = distance * cosTilt;
        return Math.min(Math.max(altitude, AbstractZoomAltitudeConverter.MIN_ALTITUDE), AbstractZoomAltitudeConverter.MAX_ALTITUDE);
    }

    altitudeToZoomLevel({
        altitude,
        latitude,
        tilt,
    }: {
        altitude: number;
        latitude: number;
        tilt: number;
    }): number {
        const clampedAltitude = Math.min(Math.max(altitude, AbstractZoomAltitudeConverter.MIN_ALTITUDE), AbstractZoomAltitudeConverter.MAX_ALTITUDE);
        const cosLat = this.cosLatitudeFactor(latitude);
        const cosTilt = this.cosTiltFactor(tilt);
        const distance = clampedAltitude / cosTilt;
        const zoomLevel = Math.log2((this.zoom0Altitude * cosLat) / distance);
        return Math.min(Math.max(zoomLevel, AbstractZoomAltitudeConverter.MIN_ZOOM_LEVEL), AbstractZoomAltitudeConverter.MAX_ZOOM_LEVEL);
    }

    mapCameraPositionToLatLngAltitude(cameraPosition: MapCameraPosition | null): google.maps.LatLngAltitudeLiteral | null {
        if (!cameraPosition) {
            return null
        }
        return {
            lat: cameraPosition.position.latitude,
            lng: cameraPosition.position.longitude,
            altitude: this.zoomLevelToAltitude({
                zoomLevel: cameraPosition.zoom,
                latitude: cameraPosition.position.latitude,
                tilt: cameraPosition.tilt,
            }) || 0,
        };
    }

    mapCameraPositionToCameraOptions(cameraPosition: MapCameraPosition | null): google.maps.maps3d.CameraOptions | null {
        if (!cameraPosition) {
            return null
        }
        return {
            altitudeMode: 'ABSOLUTE',
            cameraPosition: this.mapCameraPositionToLatLngAltitude(cameraPosition),
            tilt: cameraPosition.tilt,
            heading: cameraPosition.bearing,
        };
    }

}
