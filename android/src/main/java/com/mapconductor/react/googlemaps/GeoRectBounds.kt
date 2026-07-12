package com.mapconductor.react.googlemaps

import com.facebook.react.bridge.ReadableMap
import com.mapconductor.core.features.GeoPoint
import com.mapconductor.core.features.GeoRectBounds

fun geoRectBoundsFromReadableMap(map: ReadableMap?): GeoRectBounds {
    if (map == null) return GeoRectBounds()
    return GeoRectBounds(
        southWest = GeoPoint.fromReadableMap(map.getMap("southWest")),
        northEast = GeoPoint.fromReadableMap(map.getMap("northEast")),
    )
}
