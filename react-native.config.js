module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath:
          'import com.mapconductor.react.googlemaps.MapConductorGoogleMapsPackage;',
        packageInstance: 'new MapConductorGoogleMapsPackage()',
      },
      ios: {
        sourceDir: './ios',
      },
    },
  },
};
