'use strict'
const path = require('path')
const webpack = require('webpack')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const YFilesOptimizerPlugin = require('@yworks/optimizer/webpack-plugin')
// const FaviconsWebpackPlugin = require('favicons-webpack-plugin');
const config = {
  entry: {
    app: ['@babel/polyfill', path.resolve('app/scripts/app.js')]
  },

  output: {
    path: path.resolve(__dirname, 'app/dist/'),
    publicPath: 'dist',
    filename: '[name].js'
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components|lib)/,
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env']
        }
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader']
      },
      {
        test: /\.svg$/,
        use: 'file-loader'
      }
    ]
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        lib: {
          test: /([\\/]lib)|([\\/]node_modules[\\/])/,
          name: 'lib',
          chunks: 'all'
        }
      }
    }
  },
  plugins: [
    // https://stackoverflow.com/questions/28969861/managing-jquery-plugin-dependency-in-webpack
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery'
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css',
      chunkFilename: '[id].css'
    })
  ]
}

module.exports = function(env, options) {
  console.log('Running webpack...')

  if (options.mode === 'development') {
    config.entry.app.unshift(path.resolve('app/yfiles/yfiles-typeinfo.js'))

    config.devServer = {
      contentBase: [path.join(__dirname, './app')],
      compress: true,
      port: 9003
    }
    // don't add the default SourceMapDevToolPlugin config
    config.devtool = false
    config.plugins.push(
      new webpack.SourceMapDevToolPlugin({
        filename: '[file].map',
        // add source maps for non-library code to enable convenient debugging
        exclude: ['lib.js']
      })
    )
  }

  if (options.mode === 'production') {
    config.plugins.unshift(
      new YFilesOptimizerPlugin({
        logLevel: 'info'
      })
    )
  }

  return config
}
