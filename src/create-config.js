const fs = require('fs')
const path = require('path')
const util = require('util')
const writeFile = util.promisify(fs.writeFile)
const { promiseFiles } = require('node-dir')

const WEBPACK_CONFIG_PATH = 'webpack.config.cli.temp.js'

async function createConfig (options) {
  let config = {
    mode: 'production',
    output: {
      path: path.resolve(process.cwd(), options.outputDirectory),
      filename: '[name].min.js',
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        },
      ]
    }
  }
  
  const files = await promiseFiles(options.entryDirectory)
  config.entry = createEntryConfig(files, options)
  if (options.map) config.devtool = 'source-map'
  
  const configPath = path.resolve(WEBPACK_CONFIG_PATH)
  await writeFile(configPath, `module.exports = ${util.inspect(config, { depth: null })}`)
  
  return configPath
}

// ----- PRIVATE -----

function createEntryConfig (files, options) {
  if (!options.individual) return files.map(addCurrentDirectoryRef)
  
  let entry = {}
  files.forEach(filePath => {
    const relativeFilePath = filePath.split('/').slice(1).join('/')
    const fileName = relativeFilePath.replace(/\..*/, '')
    entry[fileName] = path.join(process.cwd(), filePath)
  })
  
  return entry
}

function addCurrentDirectoryRef (path) {
  return './'+path
}

module.exports = createConfig
