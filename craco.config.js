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
        "http": require.resolve("stream-http"),
        "https": require.resolve("https-browserify"),
        "fs": false, // MIDI libraries nutzen fs - browser-incompatible
        "child_process": false,
        "worker_threads": false,
        "net": false,
        "tls": false,
        "dns": false,
        "url": require.resolve("url"),
        "querystring": require.resolve("querystring-es3"),
      };

      // Globale Variablen bereitstellen
      webpackConfig.plugins = webpackConfig.plugins || [];
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

      // Webpack 5 Module Resolution Fix
      webpackConfig.resolve.modules = [
        ...(webpackConfig.resolve.modules || []),
        'node_modules'
      ];

      // ESM Module Support
      webpackConfig.experiments = {
        ...webpackConfig.experiments,
        topLevelAwait: true
      };

      return webpackConfig;
    },
  },
  // ESLint override for build issues
  eslint: {
    enable: false
  },
  typescript: {
    enableTypeChecking: false
  }
};