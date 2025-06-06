// MIDI-Build-Fix für Webpack 5
const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Node.js Polyfills für MIDI-Libraries
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "stream": require.resolve("stream-browserify"),
        "path": require.resolve("path-browserify"), 
        "os": require.resolve("os-browserify/browser"),
        "crypto": require.resolve("crypto-browserify"),
        "fs": false, // MIDI libraries nutzen fs - browser-incompatible
        "child_process": false,
        "worker_threads": false,
        "net": false,
        "tls": false,
        "dns": false,
      };

      // Globale Variablen bereitstellen
      webpackConfig.plugins.push(
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        })
      );

      // Ignoriere Node.js-only Module
      webpackConfig.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(bindings|node-gyp-build|prebuild-install)$/,
        })
      );

      return webpackConfig;
    },
  },
};