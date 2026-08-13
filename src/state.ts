// Native-safe entry point: only the plain-data view state and design types, with no static
// import of `@googlemaps/js-api-loader` (the web-only Maps JS API loader). `./index.ts`'s barrel
// pulls in `GoogleMapProvider`/`LibraryLoader`, which import `@googlemaps/js-api-loader` at
// module scope - fine for bundlers targeting a browser, but Metro/Hermes evaluates that eagerly
// and the loader assumes DOM globals that don't exist in React Native.
// `@mapconductor/reactnative-for-googlemaps` imports from here instead of the root barrel.
// Same arrangement as `react-for-maplibre/src/state.ts` / `react-for-arcgis/src/state.ts`.
export { GoogleMapDesign, type GoogleMapDesignType } from './GoogleMapDesign';
export {
  GoogleMapViewState,
  useGoogleMapViewState,
  type GoogleMapViewStateInterface,
} from './GoogleMapViewState';
