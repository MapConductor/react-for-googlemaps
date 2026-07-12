package com.mapconductor.react.googlemaps

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.mapconductor.core.features.GeoPoint
import com.mapconductor.core.features.GeoPointInterface
import com.mapconductor.core.features.GeoRectBounds
import com.mapconductor.core.map.MapCameraPosition
import com.mapconductor.core.map.VisibleRegion

fun MapCameraPosition.toCameraPosition(): CameraPosition =
    CameraPosition.Builder()
        .target(LatLng(position.latitude, position.longitude))
        .zoom(zoom.toFloat())
        .bearing(bearing.toFloat())
        .tilt(tilt.toFloat())
        .build()

fun MapCameraPosition.toWritableMap(): WritableMap =
    Arguments.createMap().apply {
        putMap("position", position.toWritableMap())
        putMap("center", position.toWritableMap())
        putDouble("zoom", zoom)
        putDouble("bearing", bearing)
        putDouble("tilt", tilt)
        putDouble("pitch", tilt)
        visibleRegion?.let { putMap("visibleRegion", it.toWritableMap()) }
    }

fun MapCameraPosition.Companion.fromReadableMap(map: ReadableMap?): MapCameraPosition {
    val positionMap = when {
        map == null -> null
        map.hasKey("position") -> map.getMap("position")
        map.hasKey("center") -> map.getMap("center")
        else -> null
    }

    val position = GeoPoint.fromReadableMap(positionMap) ?: GeoPoint(0.0, 0.0)

    return MapCameraPosition(
        position = position,
        zoom = map?.getDoubleOrNull("zoom") ?: 0.0,
        bearing = map?.getDoubleOrNull("bearing") ?: 0.0,
        tilt = (map?.getDoubleOrNull("tilt") ?: map?.getDoubleOrNull("pitch")) ?: 0.0,
    )
}

fun GeoPoint.toWritableMap(): WritableMap =
    Arguments.createMap().apply {
        putDouble("latitude", latitude)
        putDouble("longitude", longitude)
        putDouble("altitude", altitude ?: 0.0)
    }

private fun GeoPointInterface.toWritableMap(): WritableMap =
    Arguments.createMap().apply {
        putDouble("latitude", latitude)
        putDouble("longitude", longitude)
        putDouble("altitude", altitude ?: 0.0)
    }

private fun GeoRectBounds.toWritableMap(): WritableMap =
    Arguments.createMap().apply {
        southWest?.let { putMap("southWest", it.toWritableMap()) }
        northEast?.let { putMap("northEast", it.toWritableMap()) }
    }

private fun VisibleRegion.toWritableMap(): WritableMap =
    Arguments.createMap().apply {
        putMap("bounds", bounds.toWritableMap())
        nearLeft?.let { putMap("nearLeft", it.toWritableMap()) }
        nearRight?.let { putMap("nearRight", it.toWritableMap()) }
        farLeft?.let { putMap("farLeft", it.toWritableMap()) }
        farRight?.let { putMap("farRight", it.toWritableMap()) }
    }

fun GeoPoint.Companion.fromReadableMap(map: ReadableMap?): GeoPoint? {
    if (map == null) return null
    val latitude = map.getDoubleOrNull("latitude") ?: return null
    val longitude = map.getDoubleOrNull("longitude") ?: return null
    return GeoPoint(latitude, longitude, map.getDoubleOrNull("altitude") ?: 0.0)
}

fun ReadableMap.getDoubleOrNull(name: String): Double? =
    if (hasKey(name) && !isNull(name)) getDouble(name) else null
