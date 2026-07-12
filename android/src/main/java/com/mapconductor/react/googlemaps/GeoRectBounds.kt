package com.mapconductor.react.googlemaps

import com.facebook.react.bridge.ReadableMap
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import com.mapconductor.core.features.GeoPoint
import com.mapconductor.core.features.GeoRectBounds

fun GeoRectBounds.toLatLngBounds(): LatLngBounds? {
    val sw = southWest ?: return null
    val ne = northEast ?: return null
    return LatLngBounds(LatLng(sw.latitude, sw.longitude), LatLng(ne.latitude, ne.longitude))
}

fun geoRectBoundsFromReadableMap(map: ReadableMap?): GeoRectBounds {
    if (map == null) return GeoRectBounds()
    return GeoRectBounds(
        southWest = GeoPoint.fromReadableMap(map.getMap("southWest")),
        northEast = GeoPoint.fromReadableMap(map.getMap("northEast")),
    )
}
