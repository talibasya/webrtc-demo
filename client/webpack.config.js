let webpack = require('webpack')
var path = require('path')

function resolve (dir) {
  return path.join(__dirname, '..', dir)
}

module.exports = {
  devtool: 'sourcemap',
  context: __dirname,
  entry: "./index.js",
  watch: true,
  resolve: {
    aliasFields: ["browser"]
  },
  output: {
    filename: "index.compiled.js"
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        include: [resolve('.'),
          resolve('../node_modules/reactive-dao'), resolve('../node_modules/reactive-dao-sockjs')],
        loader: 'babel-loader',
        query: {
          presets: ['es2015', 'stage-0']
        }
      }
    ]
  }
}
