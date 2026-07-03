import { importLibrary } from '@googlemaps/js-api-loader';


interface APILibraryMap {
    core: google.maps.CoreLibrary;
    drawing: google.maps.DrawingLibrary;
    elevation: google.maps.ElevationLibrary;
    geocoding: google.maps.GeocodingLibrary;
    geometry: google.maps.GeometryLibrary;
    journeySharing: google.maps.JourneySharingLibrary;
    maps: google.maps.MapsLibrary;
    maps3d: google.maps.Maps3DLibrary;
    marker: google.maps.MarkerLibrary;
    places: google.maps.PlacesLibrary;
    routes: google.maps.RoutesLibrary;
    streetView: google.maps.StreetViewLibrary;
    visualization: google.maps.VisualizationLibrary;
}
type APILibraryName = keyof APILibraryMap;
type APILibrary = google.maps.CoreLibrary | 
    google.maps.DrawingLibrary |
    google.maps.ElevationLibrary |
    google.maps.GeocodingLibrary |
    google.maps.GeometryLibrary |
    google.maps.JourneySharingLibrary |
    google.maps.MapsLibrary |
    google.maps.Maps3DLibrary |
    google.maps.MarkerLibrary |
    google.maps.PlacesLibrary |
    google.maps.RoutesLibrary |
    google.maps.StreetViewLibrary |
    google.maps.VisualizationLibrary;

const cache: Map<APILibraryName, APILibrary> = new Map();

export async function loadLibrary<T extends APILibrary>(libraryName: APILibraryName): Promise<T> {
    const library = cache.get(libraryName);
    if (library) {
        return Promise.resolve(library as T);
    } else {
        const result = await importLibrary(libraryName) as T;
        cache.set(libraryName, result);
        return result;
    }
}

export function hasLibrary(libraryName: APILibraryName): boolean {
    return cache.has(libraryName);
}