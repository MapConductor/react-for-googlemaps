import { AbstractZoomAltitudeConverter, computeOffset, MapCameraPosition } from '@mapconductor/js-sdk-core';

// Map3DElement allows tilt in [0, 90]. Keep a hair below the horizon so the
// orbit camera never degenerates (range → ∞ at exactly 90°).
const MAX_MAP3D_TILT = 89.0;

const degToRad = (deg: number) => (deg * Math.PI) / 180;

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
        const distance = this.zoomLevelToDistance({ zoomLevel, latitude });
        const cosTilt = this.cosTiltFactor(tilt);
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
        const cosTilt = this.cosTiltFactor(tilt);
        return this.distanceToZoomLevel({ distance: clampedAltitude / cosTilt, latitude });
    }

    /**
     * Camera-to-target distance for a Google-style zoom level.
     * Mirrors android-for-arcgis ZoomAltitudeConverter.zoomLevelToDistance.
     */
    zoomLevelToDistance({
        zoomLevel,
        latitude,
    }: {
        zoomLevel: number;
        latitude: number;
    }): number {
        const clampedZoom = Math.min(Math.max(zoomLevel, AbstractZoomAltitudeConverter.MIN_ZOOM_LEVEL), AbstractZoomAltitudeConverter.MAX_ZOOM_LEVEL);
        const cosLat = this.cosLatitudeFactor(latitude);
        const distance = (this.zoom0Altitude * cosLat) / Math.pow(AbstractZoomAltitudeConverter.ZOOM_FACTOR, clampedZoom);
        return Math.min(Math.max(distance, AbstractZoomAltitudeConverter.MIN_ALTITUDE), AbstractZoomAltitudeConverter.MAX_ALTITUDE);
    }

    /** Inverse of zoomLevelToDistance. */
    distanceToZoomLevel({
        distance,
        latitude,
    }: {
        distance: number;
        latitude: number;
    }): number {
        const clampedDistance = Math.min(Math.max(distance, AbstractZoomAltitudeConverter.MIN_ALTITUDE), AbstractZoomAltitudeConverter.MAX_ALTITUDE);
        const cosLat = this.cosLatitudeFactor(latitude);
        const zoomLevel = Math.log2((this.zoom0Altitude * cosLat) / clampedDistance);
        return Math.min(Math.max(zoomLevel, AbstractZoomAltitudeConverter.MIN_ZOOM_LEVEL), AbstractZoomAltitudeConverter.MAX_ZOOM_LEVEL);
    }

    /**
     * Oblique (MapConductor) camera -> Map3DElement orbit camera.
     *
     * MapCameraPosition uses Google Maps 2D / MapLibre semantics: `position` is
     * the ground point at screen center and `tilt` is the camera's angle from
     * nadir while orbiting that point. Map3DElement's center/range/tilt model is
     * the same orbit, so the mapping is direct — the camera pose must never be
     * written via `cameraPosition` (that treats `position` as the camera's own
     * location, i.e. bird's-eye semantics, and shifts the visible center forward
     * of `position` whenever tilt > 0).
     *
     * Port of android-for-googlemaps MapCameraPosition.toCameraPosition() and
     * android-for-arcgis calculateCameraForOrbitParameters().
     */
    mapCameraPositionToCameraOptions(cameraPosition: MapCameraPosition | null): google.maps.maps3d.CameraOptions | null {
        if (!cameraPosition) {
            return null;
        }
        const { position, zoom, bearing, tilt } = cameraPosition;

        if (tilt >= 0) {
            return {
                center: {
                    lat: position.latitude,
                    lng: position.longitude,
                    altitude: position.altitude ?? 0,
                },
                range: this.zoomLevelToDistance({ zoomLevel: zoom, latitude: position.latitude }),
                tilt: Math.min(tilt, MAX_MAP3D_TILT),
                heading: bearing,
            };
        }

        // tilt < 0: 水平線より abs(tilt) 度上方を向く（仰角ビュー）。
        // Map3DElement は上向き pitch を表現できないため、camera eye（position の
        // 真上・高度 altitude）を固定したまま、地面ターゲットを bearing 方向に
        // altitude * tan(|tilt|) メートル前方へ置いて同じ視点を再現する。
        // android-for-googlemaps の tilt < 0 分岐と同じ手法。
        const tiltAbs = Math.min(-tilt, MAX_MAP3D_TILT);
        const tiltAbsRad = degToRad(tiltAbs);
        const altitude = this.zoomLevelToDistance({ zoomLevel: zoom, latitude: position.latitude });
        const target = computeOffset({
            origin: position,
            distance: altitude * Math.tan(tiltAbsRad),
            heading: bearing,
        });

        return {
            center: {
                lat: target.latitude,
                lng: target.longitude,
                altitude: 0,
            },
            range: altitude / Math.cos(tiltAbsRad),
            tilt: tiltAbs,
            heading: bearing,
        };
    }
}
