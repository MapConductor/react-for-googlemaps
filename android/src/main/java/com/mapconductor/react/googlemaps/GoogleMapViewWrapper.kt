package com.mapconductor.react.googlemaps

import android.content.Context
import android.os.SystemClock
import android.util.Log
import android.widget.FrameLayout
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.ComposeView
import com.google.android.gms.maps.GoogleMapOptions
import com.google.android.gms.maps.MapView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import com.mapconductor.compose.CollectAndRenderOverlays
import com.mapconductor.compose.MapViewScope
import com.mapconductor.compose.circle.LocalCircleCollector
import com.mapconductor.compose.groundimage.LocalGroundImageCollector
import com.mapconductor.compose.info.LocalInfoBubbleCollector
import com.mapconductor.compose.polygon.LocalPolygonCollector
import com.mapconductor.compose.polyline.LocalPolylineCollector
import com.mapconductor.compose.raster.LocalRasterLayerCollector
import com.mapconductor.core.ResourceProvider
import com.mapconductor.core.circle.CircleCapableInterface
import com.mapconductor.core.features.GeoPoint
import com.mapconductor.core.groundimage.GroundImageCapableInterface
import com.mapconductor.core.map.LocalMapOverlayRegistry
import com.mapconductor.core.map.LocalMapServiceRegistry
import com.mapconductor.core.map.LocalMapViewController
import com.mapconductor.core.map.MapCameraPosition
import com.mapconductor.core.map.MapOverlayRegistry
import com.mapconductor.core.map.MutableMapServiceRegistry
import com.mapconductor.core.marker.MarkerAnimation
import com.mapconductor.core.marker.MarkerIconInterface
import com.mapconductor.core.marker.MarkerOverlay
import com.mapconductor.core.marker.MarkerState
import com.mapconductor.core.marker.MarkerTilingOptions
import com.mapconductor.core.polygon.PolygonCapableInterface
import com.mapconductor.core.polyline.PolylineCapableInterface
import com.mapconductor.core.raster.RasterLayerCapableInterface
import com.mapconductor.googlemaps.GoogleMapViewController
import com.mapconductor.googlemaps.GoogleMapViewHolder
import com.mapconductor.googlemaps.GoogleMapViewScope
import com.mapconductor.googlemaps.GoogleMapDesignType
import com.mapconductor.googlemaps.createGoogleMapViewController
import com.mapconductor.googlemaps.toCameraPosition
import com.mapconductor.react.extensions.NativeMapExtensionHostState
import com.mapconductor.react.googlemaps.marker.ReactNativeMarkerIcon
import com.mapconductor.react.googlemaps.marker.fromReadableMap
import com.mapconductor.react.googlemaps.marker.toMarkerIcon
import com.mapconductor.react.raster.rasterLayerStateFromReadableMap
import com.mapconductor.react.raster.rasterLayerStatesFromReadableArray
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
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

    private val extensionComposeView = ComposeView(context)
    private val extensionScope = GoogleMapViewScope()
    private val extensionRegistry =
        MapOverlayRegistry().apply {
            extensionScope
                .buildRegistry()
                .getAll()
                .filterNot { it is MarkerOverlay }
                .forEach(::register)
        }
    private val extensionServiceRegistry = MutableMapServiceRegistry()
    private var mapView: MapView? = null
    private var mapHolder: GoogleMapViewHolder? = null

    // Read from the main thread (camera/lifecycle callbacks) and from markerCoroutine's
    // background thread (compositionMarkers/updateMarker). Plain `var` gives the JVM no
    // happens-before edge between onDropViewInstance()'s write and a marker-coroutine read,
    // so the background thread can observe a stale non-null reference to an already
    // torn-down controller under GC pressure; @Volatile forces the write to be visible
    // as soon as it happens instead of at some unspecified later point.
    @Volatile
    private var mapController: GoogleMapViewController? = null
    private var initialized = false
    private var pendingMapDesign: GoogleMapDesignType = ComposeGoogleMapDesign.Normal
    private var rasterLayerStates: Map<String, com.mapconductor.core.raster.RasterLayerState> = emptyMap()
    private var markerStates: List<MarkerState> = emptyList()
    private var markerCompositionGeneration: Int? = null
    private val markerCompositionBuffer = mutableListOf<MarkerState>()
    private var markerCompositionIcons: List<MarkerIconInterface?> = emptyList()
    private var markerTilingOptions = MarkerTilingOptions.Default
    private var infoBubblePositions: List<InfoBubblePosition> = emptyList()

    // Camera listeners fire on every frame during pan/zoom. When there is nothing to
    // report (marker tiling active, no markers, no open info bubbles), emitting an empty
    // positions payload every frame floods the bridge and forces a JS setState per frame,
    // so an empty payload is emitted once as a clearing event and then suppressed until
    // there is data again. Both flags are only touched on the main thread.
    private var emittedEmptyMarkerScreenPositions = false
    private var emittedEmptyInfoBubbleScreenPositions = false
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
        markerTrace("wrapper init")
        ResourceProvider.init(context)

        extensionComposeView.isClickable = false
        extensionComposeView.isFocusable = false
        addView(
            extensionComposeView,
            LayoutParams(
                LayoutParams.MATCH_PARENT,
                LayoutParams.MATCH_PARENT
            )
        )

    }

    fun initializeMapIfNeeded() {
        if (initialized) return
        initialized = true
        val initialCamera = requestedCameraPosition ?: MapCameraPosition.Default
        val nativeMapView =
            MapView(
                context,
                GoogleMapOptions()
                    .mapType(pendingMapDesign.getValue())
                    .camera(initialCamera.toCameraPosition()),
            ).apply { onCreate(null) }
        mapView = nativeMapView
        addView(
            nativeMapView,
            0,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
        )
        nativeMapView.onResume()
        nativeMapView.getMapAsync { map ->
            if (!initialized) return@getMapAsync
            val holder = GoogleMapViewHolder(nativeMapView, map)
            val controller =
                createGoogleMapViewController(
                    holder = holder,
                    markerTiling = markerTilingOptions,
                    serviceRegistry = extensionServiceRegistry,
                )
            mapHolder = holder
            mapController = controller
            configureController(controller)
            extensionComposeView.setContent {
                RenderNativeExtensions(
                    scope = extensionScope,
                    registry = extensionRegistry,
                    controller = controller,
                    serviceRegistry = extensionServiceRegistry,
                    host = nativeMapExtensionHost,
                )
            }
            var emittedMapLoaded = false
            val emitMapLoaded = emitMapLoaded@{
                if (emittedMapLoaded) return@emitMapLoaded
                emittedMapLoaded = true
                markerTrace("SDK onMapLoaded callback")
                emit("topMapLoaded", Arguments.createMap())
                emitMarkerScreenPositions()
                emitInfoBubbleScreenPositions()
            }
            controller.setMapInitializedListener { emitMapLoaded() }
            if (controller.mapLoadedState.value) {
                emitMapLoaded()
            }
            markerCoroutine.launch {
                runMarkerControllerCall { controller.compositionMarkers(markerStates) }
            }
            nativeMapView.post { controller.sendInitialCameraUpdate() }
        }
    }

    fun setCameraPosition(cameraPosition: ReadableMap?) {
        val position = MapCameraPosition.fromReadableMap(cameraPosition)
        requestedCameraPosition = position
        mapController?.moveCamera(position)
    }

    fun setMapDesignType(mapDesignType: String?) {
        val id = GoogleMapDesign.from(mapDesignType)
        pendingMapDesign = ComposeGoogleMapDesign.toMapDesignType(id)
        mapController?.setMapDesignType(pendingMapDesign)
    }

    fun moveCamera(cameraPosition: ReadableMap?) {
        val position = MapCameraPosition.fromReadableMap(cameraPosition)
        requestedCameraPosition = position
        mapController?.moveCamera(position)
    }

    fun animateCamera(
        cameraPosition: ReadableMap?,
        durationMillis: Int,
    ) {
        val position = MapCameraPosition.fromReadableMap(cameraPosition)
        requestedCameraPosition = position
        mapController?.animateCamera(position, durationMillis.toLong())
    }

    fun fitBounds(
        bounds: ReadableMap?,
        padding: Int,
    ) {
        mapController?.fitBounds(geoRectBoundsFromReadableMap(bounds), padding)
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

    private fun configureController(controller: GoogleMapViewController) {
        controller.setCameraMoveStartListener { camera ->
            emitCameraEvent("topCameraMoveStart", camera)
            emitMarkerScreenPositions()
            emitInfoBubbleScreenPositions()
        }
        controller.setCameraMoveListener { camera ->
            emitCameraEvent("topCameraMove", camera)
            emitMarkerScreenPositions()
            emitInfoBubbleScreenPositions()
        }
        controller.setCameraMoveEndListener { camera ->
            emitCameraEvent("topCameraMoveEnd", camera)
            emitMarkerScreenPositions()
            emitInfoBubbleScreenPositions()
        }
        controller.setMapClickListener { emitPointEvent("topMapClick", it) }
        controller.setMapLongClickListener { emitPointEvent("topMapLongClick", it) }
    }

    fun clearOverlays() {
        markerCoroutine.launch {
            markerStates = emptyList()
            runMarkerControllerCall { mapController?.compositionMarkers(emptyList()) }
            withContext(Dispatchers.Main) {
                infoBubblePositions = emptyList()
                emitMarkerScreenPositions()
                emitInfoBubbleScreenPositions()
            }
        }
    }

    fun compositionMarkers(payload: ReadableMap?) {
        markerCoroutine.launch {
            val previousStates = markerStates.associateBy { it.id }
            val nextStates =
                markerStatesFromBatchReadableMap(payload, context, previousStates)
                    .onEach(::attachMarkerCallbacks)
            markerStates = nextStates
            runMarkerControllerCall { mapController?.compositionMarkers(nextStates) }
            withContext(Dispatchers.Main) {
                emitMarkerScreenPositions()
                emitInfoBubbleScreenPositions()
            }
        }
    }

    fun beginMarkerComposition(
        generation: Int,
        iconDictionary: ReadableArray?,
    ) {
        markerTrace("begin received generation=$generation icons=${iconDictionary?.size() ?: 0}")
        markerCoroutine.launch {
            markerTrace("begin executing generation=$generation")
            markerCompositionGeneration = generation
            markerCompositionBuffer.clear()
            markerCompositionIcons = markerIconsFromReadableArray(iconDictionary, context)
        }
    }

    fun appendMarkerComposition(
        generation: Int,
        sequence: Int,
        payload: ReadableMap?,
    ) {
        val count = payload?.getArray("ids")?.size() ?: 0
        markerTrace("append received generation=$generation sequence=$sequence count=$count")
        markerCoroutine.launch {
            val startedAt = SystemClock.elapsedRealtime()
            if (markerCompositionGeneration != generation) {
                markerTrace("append ignored generation=$generation sequence=$sequence current=$markerCompositionGeneration")
                return@launch
            }
            markerCompositionBuffer +=
                markerStatesFromBatchReadableMap(
                    payload = payload,
                    context = context,
                    sharedIcons = markerCompositionIcons,
                )
                    .onEach(::attachMarkerCallbacks)
            markerTrace(
                "append decoded generation=$generation sequence=$sequence count=$count " +
                    "buffer=${markerCompositionBuffer.size} elapsedMs=${SystemClock.elapsedRealtime() - startedAt}",
            )
            withContext(Dispatchers.Main) {
                markerTrace("append ACK emit generation=$generation sequence=$sequence")
                emitMarkerCompositionBatchProcessed(generation, sequence)
            }
        }
    }

    fun commitMarkerComposition(generation: Int) {
        markerTrace("commit received generation=$generation")
        markerCoroutine.launch {
            if (markerCompositionGeneration != generation) {
                markerTrace("commit ignored generation=$generation current=$markerCompositionGeneration")
                return@launch
            }
            val nextStates = markerCompositionBuffer.toList()
            markerCompositionBuffer.clear()
            markerCompositionIcons = emptyList()
            markerCompositionGeneration = null
            val startedAt = SystemClock.elapsedRealtime()
            markerTrace("commit controller assignment start generation=$generation count=${nextStates.size}")
            markerStates = nextStates
            runMarkerControllerCall { mapController?.compositionMarkers(nextStates) }
            markerTrace(
                "commit controller assignment end generation=$generation count=${nextStates.size} " +
                    "elapsedMs=${SystemClock.elapsedRealtime() - startedAt}",
            )
            withContext(Dispatchers.Main) {
                emitMarkerScreenPositions()
                emitInfoBubbleScreenPositions()
            }
        }
    }

    fun updateMarker(marker: ReadableMap?) {
        markerCoroutine.launch {
            val previousStates = markerStates
            val id = marker?.getStringOrNull("id") ?: return@launch
            val existing = previousStates.firstOrNull { it.id == id }
            if (existing == null) {
                val state = markerStateFromReadableMap(marker, context) ?: return@launch
                attachMarkerCallbacks(state)
                markerStates = markerStates + state
                runMarkerControllerCall { mapController?.compositionMarkers(markerStates) }
                withContext(Dispatchers.Main) {
                    emitMarkerScreenPositions()
                    emitInfoBubbleScreenPositions()
                }
                return@launch
            }

            existing.applyReadableMap(marker, context)
            attachMarkerCallbacks(existing)
            runMarkerControllerCall { mapController?.updateMarker(existing) }
            withContext(Dispatchers.Main) {
                emitMarkerScreenPositions()
                emitInfoBubbleScreenPositions()
            }
        }
    }

    fun compositionRasterLayers(layers: ReadableArray?) {
        val states = rasterLayerStatesFromReadableArray(layers)
        val previousIds = rasterLayerStates.keys
        rasterLayerStates = states.associateBy { it.id }
        val extensionLayers =
            extensionScope.rasterLayerCollector.flow.value.filterKeys { id -> id !in previousIds }
        extensionScope.rasterLayerCollector.flow.value =
            (extensionLayers + rasterLayerStates).toMutableMap()
    }

    fun updateRasterLayer(layer: ReadableMap?) {
        val state = rasterLayerStateFromReadableMap(layer) ?: return
        rasterLayerStates = rasterLayerStates + (state.id to state)
        extensionScope.rasterLayerCollector.flow.value =
            extensionScope.rasterLayerCollector.flow.value
                .toMutableMap()
                .apply { put(state.id, state) }
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
        markerTrace("wrapper drop")
        initialized = false
        nativeMapExtensionHost.clear()
        extensionComposeView.disposeComposition()
        // Null the field before destroying: a marker-coroutine job that reads mapController
        // after this point sees null and no-ops, instead of getting a reference to a
        // controller whose MarkerManager is about to be (or just was) destroyed.
        val controller = mapController
        mapController = null
        mapHolder = null
        controller?.destroy()
        mapView?.onPause()
        mapView?.onDestroy()
        mapView = null
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
        mapView?.layout(0, 0, right - left, bottom - top)
        extensionComposeView.layout(0, 0, right - left, bottom - top)
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
        val tilingActive = markerStates.size >= markerTilingOptions.minMarkerCount
        if (tilingActive || markerStates.isEmpty()) {
            if (emittedEmptyMarkerScreenPositions) return
            emittedEmptyMarkerScreenPositions = true
            mainCoroutine.launch {
                emit(
                    "topMarkerScreenPositions",
                    Arguments.createMap().apply { putArray("positions", Arguments.createArray()) },
                )
            }
            return
        }
        emittedEmptyMarkerScreenPositions = false
        mainCoroutine.launch {
            val density = ResourceProvider.getDensity()
            val holder = mapHolder ?: return@launch
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
        if (infoBubblePositions.isEmpty()) {
            if (emittedEmptyInfoBubbleScreenPositions) return
            emittedEmptyInfoBubbleScreenPositions = true
            mainCoroutine.launch {
                emit(
                    "topInfoBubbleScreenPositions",
                    Arguments.createMap().apply { putArray("positions", Arguments.createArray()) },
                )
            }
            return
        }
        emittedEmptyInfoBubbleScreenPositions = false
        mainCoroutine.launch {
            val density = ResourceProvider.getDensity()
            val holder = mapHolder ?: return@launch
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
        val camera = latestCameraPosition ?: requestedCameraPosition ?: MapCameraPosition.Default
        if (camera.visibleRegion == null) return null
        return Wms84Projection(camera, width, height)
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

    private fun emitMarkerCompositionBatchProcessed(
        generation: Int,
        sequence: Int,
    ) {
        emit(
            "topMarkerCompositionBatchProcessed",
            Arguments.createMap().apply {
                putInt("generation", generation)
                putInt("sequence", sequence)
            },
        )
    }

    private fun markerTrace(message: String) {
        Log.d(
            MARKER_TRACE_TAG,
            "[GoogleMaps][RN][t=${SystemClock.elapsedRealtime()}]" +
                "[thread=${Thread.currentThread().name}] $message",
        )
    }

    /**
     * Marker composition/update work runs on markerCoroutine's background thread, which can
     * still have a command in flight when onDropViewInstance() destroys the controller's
     * MarkerManager on the main thread (the view is gone, but a stale in-flight update isn't
     * an error worth crashing the app over). Swallow only that specific race; anything else,
     * including cancellation, propagates normally.
     */
    private suspend fun runMarkerControllerCall(block: suspend () -> Unit) {
        try {
            block()
        } catch (e: CancellationException) {
            throw e
        } catch (e: IllegalStateException) {
            markerTrace("marker controller call skipped after teardown: ${e.message}")
        }
    }
}

@Composable
private fun RenderNativeExtensions(
    scope: MapViewScope,
    registry: MapOverlayRegistry,
    controller: GoogleMapViewController,
    serviceRegistry: MutableMapServiceRegistry,
    host: NativeMapExtensionHostState,
) {
    DisposableEffect(controller) {
        scope.groundImageCollector.setUpdateHandler { state ->
            (controller as GroundImageCapableInterface).let { capable ->
                if (capable.hasGroundImage(state)) capable.updateGroundImage(state)
            }
        }
        scope.rasterLayerCollector.setUpdateHandler { state ->
            (controller as RasterLayerCapableInterface).let { capable ->
                if (capable.hasRasterLayer(state)) capable.updateRasterLayer(state)
            }
        }
        scope.polygonCollector.setUpdateHandler { state ->
            (controller as PolygonCapableInterface).let { capable ->
                if (capable.hasPolygon(state)) capable.updatePolygon(state)
            }
        }
        scope.polylineCollector.setUpdateHandler { state ->
            (controller as PolylineCapableInterface).let { capable ->
                if (capable.hasPolyline(state)) capable.updatePolyline(state)
            }
        }
        scope.circleCollector.setUpdateHandler { state ->
            (controller as CircleCapableInterface).let { capable ->
                if (capable.hasCircle(state)) capable.updateCircle(state)
            }
        }
        onDispose {
            scope.groundImageCollector.setUpdateHandler(null)
            scope.rasterLayerCollector.setUpdateHandler(null)
            scope.polygonCollector.setUpdateHandler(null)
            scope.polylineCollector.setUpdateHandler(null)
            scope.circleCollector.setUpdateHandler(null)
        }
    }

    CollectAndRenderOverlays(
        registry = registry,
        controller = controller,
    )
    CompositionLocalProvider(
        LocalMapOverlayRegistry provides registry,
        LocalMapServiceRegistry provides serviceRegistry,
        LocalMapViewController provides controller,
        LocalInfoBubbleCollector provides scope.bubbleFlow,
        LocalCircleCollector provides scope.circleCollector,
        LocalPolylineCollector provides scope.polylineCollector,
        LocalPolygonCollector provides scope.polygonCollector,
        LocalGroundImageCollector provides scope.groundImageCollector,
        LocalRasterLayerCollector provides scope.rasterLayerCollector,
    ) {
        with(scope) {
            with(host) { RenderExtensions() }
        }
    }
}

private const val MARKER_TRACE_TAG = "MCMarkerTrace"

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
 * Decodes the compressed compositionMarkers() batch payload: structure-of-arrays referring to
 * the composition-level icon dictionary registered by beginMarkerComposition().
 * This avoids ~7 hasKey/isNull/getX JNI calls per marker field that per-marker maps needed, and
 * avoids re-decoding an identical icon definition once per marker.
 */
private fun markerStatesFromBatchReadableMap(
    payload: ReadableMap?,
    context: Context,
    previousStates: Map<String, MarkerState> = emptyMap(),
    sharedIcons: List<MarkerIconInterface?>? = null,
): List<MarkerState> {
    if (payload == null) return emptyList()
    val ids = payload.getArray("ids") ?: return emptyList()
    val positions = payload.getArray("positions") ?: return emptyList()
    val clickableArr = payload.getArray("clickable")
    val draggableArr = payload.getArray("draggable")
    val zIndexArr = payload.getArray("zIndex")
    val iconIndexArr = payload.getArray("iconIndex")
    val animationArr = payload.getArray("animation")
    val icons = sharedIcons ?: markerIconsFromReadableArray(payload.getArray("icons"), context)

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

private fun markerIconsFromReadableArray(
    iconDictionary: ReadableArray?,
    context: Context,
): List<MarkerIconInterface?> =
    if (iconDictionary == null) {
        emptyList()
    } else {
        (0 until iconDictionary.size()).map { index ->
            ReactNativeMarkerIcon.fromReadableMap(iconDictionary.getMap(index))?.toMarkerIcon(context)
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
