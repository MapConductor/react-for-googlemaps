package com.mapconductor.react.googlemaps

import android.content.Context
import android.widget.FrameLayout
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import com.mapconductor.compose.marker.Markers
import com.mapconductor.react.extensions.NativeMapExtensionHostState
import com.mapconductor.core.ResourceProvider
import com.mapconductor.core.features.GeoPoint
import com.mapconductor.core.map.MapCameraPosition
import com.mapconductor.core.marker.MarkerAnimation
import com.mapconductor.core.marker.MarkerIconInterface
import com.mapconductor.core.marker.MarkerState
import com.mapconductor.core.marker.MarkerTilingOptions
import com.mapconductor.googlemaps.GoogleMapView
import com.mapconductor.googlemaps.GoogleMapViewState
import com.mapconductor.googlemaps.circle.GoogleMapCircleControllerInterface
import com.mapconductor.googlemaps.groundimage.GoogleMapGroundImageControllerInterface
import com.mapconductor.googlemaps.marker.GoogleMapMarkerControllerInterface
import com.mapconductor.googlemaps.polygon.GoogleMapPolygonControllerInterface
import com.mapconductor.googlemaps.polyline.GoogleMapPolylineControllerInterface
import com.mapconductor.googlemaps.raster.GoogleMapRasterLayerControllerInterface
import com.mapconductor.react.googlemaps.marker.ReactNativeMarkerIcon
import com.mapconductor.react.googlemaps.marker.fromReadableMap
import com.mapconductor.react.googlemaps.marker.toMarkerIcon
import com.mapconductor.react.raster.rasterLayerStateFromReadableMap
import com.mapconductor.react.raster.rasterLayerStatesFromReadableArray
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID
import java.util.concurrent.Executors
import com.mapconductor.googlemaps.GoogleMapDesign as ComposeGoogleMapDesign

class GoogleMapViewWrapper(context: Context) :
    FrameLayout(context) {

    companion object {
        // Shared across all wrapper instances, one background thread. ReadableArray/ReadableMap
        // parsing and marker-icon decoding (JNI + bitmap I/O) happen here instead of the UI
        // thread, so a large compositionMarkers() batch (e.g. 20k+ markers) doesn't freeze the
        // map screen while it loads. Single-threaded so that commits from overlapping
        // compositionMarkers/updateMarker calls on the same view are applied to `markerStates`
        // in the order React Native issued them.
        private val markerIngestDispatcher: CoroutineDispatcher =
            Executors.newSingleThreadExecutor { r ->
                Thread(r, "GoogleMapMarkerIngest").apply { isDaemon = true }
            }.asCoroutineDispatcher()
    }

    private val mainCoroutine: CoroutineScope = CoroutineScope(Dispatchers.Main)
    private val markerCoroutine: CoroutineScope = CoroutineScope(markerIngestDispatcher)

    private val composeView = ComposeView(context)
    private val mapViewState = GoogleMapViewState(
        id = "googlemap-${UUID.randomUUID()}",
        mapDesignType = ComposeGoogleMapDesign.Normal
    )

    private var markerController: GoogleMapMarkerControllerInterface? = null
    private var circleController: GoogleMapCircleControllerInterface? = null
    private var polylineController: GoogleMapPolylineControllerInterface? = null
    private var polylgonController: GoogleMapPolygonControllerInterface? = null
    private var groundImageController: GoogleMapGroundImageControllerInterface? = null
    private var rasterLayerController: GoogleMapRasterLayerControllerInterface? = null
    private var rasterLayerStates: Map<String, com.mapconductor.core.raster.RasterLayerState> = emptyMap()
    private var markerStates by mutableStateOf<List<MarkerState>>(emptyList())
    private var markerTilingOptions by mutableStateOf(MarkerTilingOptions.Default)
    private var infoBubblePositions: List<InfoBubblePosition> = emptyList()
    private var latestCameraPosition: MapCameraPosition? = null
    private var requestedCameraPosition: MapCameraPosition? = null
    private val nativeMapExtensionHost =
        NativeMapExtensionHostState(context) { extensionId, eventName, payload ->
            emit(
                "topNativeMapExtensionEvent",
                Arguments.createMap().apply {
                    putString("extensionId", extensionId)
                    putString("eventName", eventName)
                    putMap("payload", payload)
                },
            )
        }

    init {
        ResourceProvider.init(context)

        addView(
            composeView,
            LayoutParams(
                LayoutParams.MATCH_PARENT,
                LayoutParams.MATCH_PARENT
            )
        )

        composeView.setContent {
            GoogleMapView(
                state = mapViewState,
                modifier = Modifier.fillMaxSize(),
                markerTiling = markerTilingOptions,
                onMapLoaded = {
                    mapViewState.getControllers()?.entries?.forEach { (key, value) ->
                        when(key) {
                            "marker" -> markerController = value as GoogleMapMarkerControllerInterface?
                            "circle" -> circleController = value as GoogleMapCircleControllerInterface?
                            "polyline" -> polylineController = value as GoogleMapPolylineControllerInterface?
                            "polygon" -> polylgonController = value as GoogleMapPolygonControllerInterface?
                            "ground_image" -> groundImageController = value as GoogleMapGroundImageControllerInterface?
                            "raster_layer" -> {
                                rasterLayerController = value as GoogleMapRasterLayerControllerInterface?
                                mainCoroutine.launch {
                                    rasterLayerController?.add(rasterLayerStates.values.toList())
                                }
                            }
                        }
                    }
                    emit("topMapLoaded", Arguments.createMap())
                    emitMarkerScreenPositions()
                    emitInfoBubbleScreenPositions()
                },
                onMapClick = {
                    emitPointEvent("topMapClick", it)
                },
                onMapLongClick = {
                    emitPointEvent("topMapLongClick", it)
                },
                onCameraMoveStart = {
                    emitCameraEvent("topCameraMoveStart", it)
                    emitMarkerScreenPositions()
                    emitInfoBubbleScreenPositions()
                },
                onCameraMove = {
                    emitCameraEvent("topCameraMove", it)
                    emitMarkerScreenPositions()
                    emitInfoBubbleScreenPositions()
                },
                onCameraMoveEnd = {
                    emitCameraEvent("topCameraMoveEnd", it)
                    emitMarkerScreenPositions()
                    emitInfoBubbleScreenPositions()
                },
            ) {
                Markers(states = markerStates)
                with(nativeMapExtensionHost) { RenderExtensions() }
            }
        }
    }

    fun setCameraPosition(cameraPosition: ReadableMap?) {
        val position = MapCameraPosition.fromReadableMap(cameraPosition)
        requestedCameraPosition = position
        mapViewState.moveCameraTo(position, null)
    }

    fun setMapDesignType(mapDesignType: String?) {
        val id = GoogleMapDesign.from(mapDesignType)
        mapViewState.mapDesignType = ComposeGoogleMapDesign.toMapDesignType(id)
    }

    fun moveCamera(cameraPosition: ReadableMap?) {
        val position = MapCameraPosition.fromReadableMap(cameraPosition)
        requestedCameraPosition = position
        mapViewState.moveCameraTo(position, null)
    }

    fun animateCamera(
        cameraPosition: ReadableMap?,
        durationMillis: Int,
    ) {
        val position = MapCameraPosition.fromReadableMap(cameraPosition)
        requestedCameraPosition = position
        mapViewState.moveCameraTo(position, durationMillis.toLong())
    }

    fun fitBounds(
        bounds: ReadableMap?,
        padding: Int,
    ) {
        mapViewState.fitBounds(geoRectBoundsFromReadableMap(bounds), padding)
    }

    fun setInfoBubblePositions(positions: ReadableArray?) {
        infoBubblePositions =
            (0 until (positions?.size() ?: 0)).mapNotNull { index ->
                val position = positions?.getMap(index) ?: return@mapNotNull null
                val id = position.getStringOrNull("id") ?: return@mapNotNull null
                val point = GeoPoint.fromReadableMap(position) ?: return@mapNotNull null
                InfoBubblePosition(id = id, point = point)
            }
        emitInfoBubbleScreenPositions()
    }

    fun setMarkerTilingOptions(options: ReadableMap?) {
        markerTilingOptions = markerTilingOptionsFromReadableMap(options)
    }

    fun clearOverlays() {}

    fun compositionMarkers(payload: ReadableMap?) {
        val previousStates = markerStates.associateBy { it.id }
        markerCoroutine.launch {
            val nextStates =
                markerStatesFromBatchReadableMap(payload, context, previousStates)
                    .onEach(::attachMarkerCallbacks)
            withContext(Dispatchers.Main) {
                markerStates = nextStates
                emitMarkerScreenPositions()
                emitInfoBubbleScreenPositions()
            }
        }
    }

    fun updateMarker(marker: ReadableMap?) {
        val previousStates = markerStates
        markerCoroutine.launch {
            val id = marker?.getStringOrNull("id") ?: return@launch
            val existing = previousStates.firstOrNull { it.id == id }
            if (existing == null) {
                val state = markerStateFromReadableMap(marker, context) ?: return@launch
                attachMarkerCallbacks(state)
                withContext(Dispatchers.Main) {
                    markerStates = markerStates + state
                    emitMarkerScreenPositions()
                    emitInfoBubbleScreenPositions()
                }
                return@launch
            }

            existing.applyReadableMap(marker, context)
            attachMarkerCallbacks(existing)
            withContext(Dispatchers.Main) {
                emitMarkerScreenPositions()
                emitInfoBubbleScreenPositions()
            }
        }
    }

    fun compositionRasterLayers(layers: ReadableArray?) {
        val states = rasterLayerStatesFromReadableArray(layers)
        rasterLayerStates = states.associateBy { it.id }
        mainCoroutine.launch {
            rasterLayerController?.clear()
            rasterLayerController?.add(states)
        }
    }

    fun updateRasterLayer(layer: ReadableMap?) {
        val state = rasterLayerStateFromReadableMap(layer) ?: return
        rasterLayerStates = rasterLayerStates + (state.id to state)
        mainCoroutine.launch {
            rasterLayerController?.update(state)
        }
    }

    fun upsertNativeMapExtension(
        extensionId: String,
        type: String,
        payload: ReadableMap?,
    ) {
        nativeMapExtensionHost.upsert(extensionId, type, payload)
    }

    fun removeNativeMapExtension(extensionId: String) {
        nativeMapExtensionHost.remove(extensionId)
    }

    fun onDropViewInstance() {
        nativeMapExtensionHost.clear()
        markerCoroutine.cancel()
        mainCoroutine.cancel()
    }

    override fun onLayout(
        changed: Boolean,
        left: Int,
        top: Int,
        right: Int,
        bottom: Int,
    ) {
        super.onLayout(changed, left, top, right, bottom)
        composeView.layout(0, 0, right - left, bottom - top)
        emitMarkerScreenPositions()
        emitInfoBubbleScreenPositions()
    }

    private fun attachMarkerCallbacks(state: MarkerState) {
        state.onClick = {
            emit("topMarkerClick", Arguments.createMap().apply { putString("markerId", it.id) })
        }
    }

    private fun emitCameraEvent(
        eventName: String,
        camera: MapCameraPosition,
    ) {
        val logicalCamera = restoreRequestedNegativeTiltCamera(camera)
        latestCameraPosition = logicalCamera
        emit(eventName, Arguments.createMap().apply { putMap("cameraPosition", logicalCamera.toWritableMap()) })
    }

    private fun restoreRequestedNegativeTiltCamera(camera: MapCameraPosition): MapCameraPosition {
        val requested = requestedCameraPosition ?: return camera
        if (requested.tilt >= 0.0) return camera

        return camera.copy(
            position = requested.position,
            tilt = requested.tilt,
        )
    }

    private fun emitPointEvent(
        eventName: String,
        point: GeoPoint,
    ) {
        emit(eventName, Arguments.createMap().apply { putMap("point", point.toWritableMap()) })
    }

    private fun emitMarkerScreenPositions() {
        mainCoroutine.launch {
            if (markerStates.size >= markerTilingOptions.minMarkerCount) {
                emit(
                    "topMarkerScreenPositions",
                    Arguments.createMap().apply { putArray("positions", Arguments.createArray()) },
                )
                return@launch
            }
            val density = ResourceProvider.getDensity()
            val holder = mapViewState.getMapViewHolder() ?: return@launch
            val projection = screenProjection()
            val array =
                Arguments.createArray().apply {
                    markerStates.forEach { marker ->
                        val offset =
                            projection?.toScreenOffset(marker.position)
                                ?: holder.toScreenOffset(marker.position)
                                ?: return@forEach
                        pushMap(
                            Arguments.createMap().apply {
                                putString("markerId", marker.id)
                                putDouble("x", offset.x.toDouble() / density)
                                putDouble("y", offset.y.toDouble() / density)
                            },
                        )
                    }
                }
            emit("topMarkerScreenPositions", Arguments.createMap().apply { putArray("positions", array) })
        }
    }

    private fun emitInfoBubbleScreenPositions() {
        mainCoroutine.launch {
            val density = ResourceProvider.getDensity()
            val holder = mapViewState.getMapViewHolder() ?: return@launch
            val projection = screenProjection()
            val array =
                Arguments.createArray().apply {
                    infoBubblePositions.forEach { position ->
                        val offset =
                            projection?.toScreenOffset(position.point)
                                ?: holder.toScreenOffset(position.point)
                                ?: return@forEach
                        pushMap(
                            Arguments.createMap().apply {
                                putString("id", position.id)
                                putDouble("x", offset.x.toDouble() / density)
                                putDouble("y", offset.y.toDouble() / density)
                            },
                        )
                    }
                }
            emit("topInfoBubbleScreenPositions", Arguments.createMap().apply { putArray("positions", array) })
        }
    }

    private fun screenProjection(): Wms84Projection? {
        val camera = latestCameraPosition ?: mapViewState.cameraPosition
        if (camera.visibleRegion == null) return null
        return Wms84Projection(camera, composeView.width, composeView.height)
    }

    private fun emit(
        eventName: String,
        event: WritableMap,
    ) {
        val reactContext = context as? ReactContext ?: return
        val surfaceId = UIManagerHelper.getSurfaceId(this)
        UIManagerHelper.getEventDispatcher(reactContext)
            ?.dispatchEvent(GoogleMapViewWrapperEvent(surfaceId, id, eventName, event))
    }
}

private fun markerTilingOptionsFromReadableMap(map: ReadableMap?): MarkerTilingOptions {
    if (map == null) return MarkerTilingOptions.Default
    return MarkerTilingOptions.Default.copy(
        enabled = map.getBooleanOrNull("enabled") ?: MarkerTilingOptions.Default.enabled,
        debugTileOverlay = map.getBooleanOrNull("debugTileOverlay")
            ?: MarkerTilingOptions.Default.debugTileOverlay,
        minMarkerCount = map.getIntOrNull("minMarkerCount") ?: MarkerTilingOptions.Default.minMarkerCount,
        cacheSize = map.getIntOrNull("cacheSize") ?: MarkerTilingOptions.Default.cacheSize,
    )
}

private data class InfoBubblePosition(
    val id: String,
    val point: GeoPoint,
)

/**
 * Decodes the compressed compositionMarkers() batch payload: structure-of-arrays with an icon
 * dictionary (see `encodeMarkerBatch` on the JS side), instead of one ReadableMap per marker.
 * This avoids ~7 hasKey/isNull/getX JNI calls per marker field that per-marker maps needed, and
 * avoids re-decoding an identical icon definition once per marker.
 */
private fun markerStatesFromBatchReadableMap(
    payload: ReadableMap?,
    context: Context,
    previousStates: Map<String, MarkerState> = emptyMap(),
): List<MarkerState> {
    if (payload == null) return emptyList()
    val ids = payload.getArray("ids") ?: return emptyList()
    val positions = payload.getArray("positions") ?: return emptyList()
    val clickableArr = payload.getArray("clickable")
    val draggableArr = payload.getArray("draggable")
    val zIndexArr = payload.getArray("zIndex")
    val iconIndexArr = payload.getArray("iconIndex")
    val animationArr = payload.getArray("animation")
    val iconDict = payload.getArray("icons")
    val icons: List<MarkerIconInterface?> =
        if (iconDict == null) {
            emptyList()
        } else {
            (0 until iconDict.size()).map { index ->
                ReactNativeMarkerIcon.fromReadableMap(iconDict.getMap(index))?.toMarkerIcon(context)
            }
        }

    return buildList {
        for (index in 0 until ids.size()) {
            val id = ids.getString(index) ?: continue
            val position =
                GeoPoint(
                    latitude = positions.getDouble(index * 3),
                    longitude = positions.getDouble(index * 3 + 1),
                    altitude = positions.getDouble(index * 3 + 2),
                )
            val clickable = clickableArr?.getBoolean(index) ?: true
            val draggable = draggableArr?.getBoolean(index) ?: false
            val zIndex = zIndexArr?.getDouble(index)?.toInt()
            val iconIdx = iconIndexArr?.getInt(index) ?: -1
            val icon = icons.getOrNull(iconIdx)
            val animation =
                if (animationArr != null && !animationArr.isNull(index)) {
                    runCatching { MarkerAnimation.valueOf(animationArr.getString(index) ?: "") }.getOrNull()
                } else {
                    null
                }

            val existing = previousStates[id]
            if (existing != null) {
                existing.position = position
                existing.clickable = clickable
                existing.draggable = draggable
                existing.zIndex = zIndex
                existing.icon = icon
                animation?.let(existing::animate)
                add(existing)
            } else {
                add(
                    MarkerState(
                        id = id,
                        position = position,
                        clickable = clickable,
                        draggable = draggable,
                        zIndex = zIndex,
                        icon = icon,
                        animation = animation,
                    ),
                )
            }
        }
    }
}

private fun markerStateFromReadableMap(
    map: ReadableMap?,
    context: Context,
): MarkerState? {
    if (map == null) return null
    val id = if (map.hasKey("id") && !map.isNull("id")) map.getString("id") else null
    val position = GeoPoint.fromReadableMap(map.getMap("position"))
    if (id == null || position == null) return null
    return MarkerState(
        id = id,
        position = position,
        clickable = if (map.hasKey("clickable") && !map.isNull("clickable")) map.getBoolean("clickable") else true,
        draggable = if (map.hasKey("draggable") && !map.isNull("draggable")) map.getBoolean("draggable") else false,
        zIndex = map.getDoubleOrNull("zIndex")?.toInt(),
        icon = ReactNativeMarkerIcon.fromReadableMap(if (map.hasKey("icon") && !map.isNull("icon")) map.getMap("icon") else null)
            ?.toMarkerIcon(context),
        animation = if (map.hasKey("animation") && !map.isNull("animation")) {
            runCatching { MarkerAnimation.valueOf(map.getString("animation") ?: "") }.getOrNull()
        } else {
            null
        },
    )
}

private fun MarkerState.applyReadableMap(
    map: ReadableMap,
    context: Context,
) {
    GeoPoint.fromReadableMap(map.getMapOrNull("position"))?.let { position = it }
    clickable = if (map.hasKey("clickable") && !map.isNull("clickable")) map.getBoolean("clickable") else true
    draggable = if (map.hasKey("draggable") && !map.isNull("draggable")) map.getBoolean("draggable") else false
    zIndex = map.getDoubleOrNull("zIndex")?.toInt()
    icon = ReactNativeMarkerIcon.fromReadableMap(map.getMapOrNull("icon"))?.toMarkerIcon(context)

    markerAnimationFromReadableMap(map)?.let { animation ->
        animate(animation)
    }
}

private fun markerAnimationFromReadableMap(map: ReadableMap): MarkerAnimation? =
    if (map.hasKey("animation") && !map.isNull("animation")) {
        runCatching { MarkerAnimation.valueOf(map.getString("animation") ?: "") }.getOrNull()
    } else {
        null
    }

private fun ReadableMap.getStringOrNull(key: String): String? =
    if (hasKey(key) && !isNull(key)) getString(key) else null

private fun ReadableMap.getMapOrNull(key: String): ReadableMap? =
    if (hasKey(key) && !isNull(key)) getMap(key) else null

private fun ReadableMap.getBooleanOrNull(key: String): Boolean? =
    if (hasKey(key) && !isNull(key)) getBoolean(key) else null

private fun ReadableMap.getIntOrNull(key: String): Int? =
    if (hasKey(key) && !isNull(key)) getInt(key) else null

private class GoogleMapViewWrapperEvent(
    surfaceId: Int,
    viewTag: Int,
    private val name: String,
    private val payload: WritableMap,
) : Event<GoogleMapViewWrapperEvent>(surfaceId, viewTag) {
    override fun getEventName(): String = name

    override fun canCoalesce(): Boolean = false

    override fun getEventData(): WritableMap = payload
}
