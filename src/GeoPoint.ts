/// <reference types="google.maps" />
import { GeoPointInterface } from "@mapconductor/core";

export function geoPointToLatLngAltitude(position: GeoPointInterface | null): google.maps.LatLngAltitudeLiteral | null {
    if (!position) {
        return null
    }
    return {
        lat: position.latitude,
        lng: position.longitude,
        altitude: position.altitude || 0,
    };
}

