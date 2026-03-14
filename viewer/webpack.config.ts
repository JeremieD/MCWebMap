const path = require('path');

const isProd = process.env.npm_lifecycle_event === "webpack-prod";

module.exports = {
  entry: './src/ts/main.ts',
  mode: isProd ? 'production' : 'development',
  optimization: {
    usedExports: true
  },
  devtool: isProd ? false : 'eval-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist/resources/js'),
    clean: true
  }
};
