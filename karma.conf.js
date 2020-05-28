const webpackConfig = require('./webpack.config');

module.exports = (config) => {
  config.set({
    frameworks: ['jasmine', 'sinon'],
    files: ['src/**/*.spec.ts'],
    preprocessors: {
      'src/**/*.spec.ts': ['webpack'],
    },
    webpack: {
        module: webpackConfig.module,
        resolve: webpackConfig.resolve,
        mode: webpackConfig.mode,
        devtool: webpackConfig.devtool,
    },
    reporters: ['spec'],
    browsers: ['ChromeHeadless'],
    singleRun: true,
    client: {
      captureConsole: false,
    }
  });
};
