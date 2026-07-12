package com.mapconductor.react.googlemaps

import com.google.android.gms.maps.GoogleMap

object GoogleMapDesign {
    const val NORMAL = GoogleMap.MAP_TYPE_NORMAL
    const val SATELLITE = GoogleMap.MAP_TYPE_SATELLITE
    const val TERRAIN = GoogleMap.MAP_TYPE_TERRAIN
    const val HYBRID = GoogleMap.MAP_TYPE_HYBRID
    const val NONE = GoogleMap.MAP_TYPE_NONE

    fun from(value: String?): Int =
        when (value) {
            "satellite" -> SATELLITE
            "terrain" -> TERRAIN
            "hybrid" -> HYBRID
            "none" -> NONE
            else -> NORMAL
        }
}
