#!/usr/bin/env node

const arg = require('arg')
const inquirer = require('inquirer')
const { logStatus, exec } = require('./helpers')
const createConfig = require('./create-config')
const Listr = require('listr')
const fs = require('fs')
const util = require('util')
const readdir = util.promisify(fs.readdir)
const { version } = require('../package.json')

/**
 * @name cli
 * @param {Array} args - Array of arguments from the command process. For more
 * information on the args available, run `transpuglify --help`
 * @returns {Boolean} - Returns true if the process completed without errors
 */
async function cli (args) {
  try {
    const wasAlreadyActioned = actionImmediatelyActionableArguments(args)
    if (wasAlreadyActioned) return
    
    const initOptions = parseArgumentsIntoOptions(args)
    
    if (initOptions.help) return displayHelpMenu()
    if (initOptions.version) return displayVersion()
    
    const finalizedOptions = await promptForMissingOptions(initOptions)
    const tasks = createTasks(finalizedOptions)
    
    logStatus.info('Initiating transpuglification')
    await tasks.run()
    logStatus.success('File(s) successfully transpuglified')
    return true
  } catch (error) {
    logStatus.error(error)
    return false
  }
}

cli(process.argv)

// ----- PRIVATE -----

// Check to see if arguments that can be actioned immediately were supplied and
// performs the action (if found)
function actionImmediatelyActionableArguments (rawArgs) {
  // Return help menu if "help" or nothing is supplied
  if (rawArgs.length === 2 || rawArgs[2] === 'help') {
    displayHelpMenu()
    return true
  }
  
  if (rawArgs[2] === 'version') {
    displayVersion()
    return true
  }
  
  return false
}

function displayHelpMenu () {
  console.log(`
    Usage: transpuglify [flags]
    
    --version, -v ..................show package version
    --help, -h .....................show help menu
    --map, -m ......................include source maps
    --outputDirectory, -o <path> ...specify path for the transformed files to be saved
    --entryDirectory, -e <path> ....specify parent directory path where the original files are stored
    --individual, -i ...............create individually transformed files
   `)
}

function displayVersion () {
  console.log(version)
}

function parseArgumentsIntoOptions (rawArgs) {
  const args = arg({
      // Types
      '--help': Boolean,
      '--version': Boolean,
      '--map': Boolean,
      '--outputDirectory': String,
      '--entryDirectory': String,
      '--individual': Boolean,
      // Aliases
      '-h': '--help',
      '-v': '--version',
      '-m': '--map',
      '-o': '--outputDirectory',
      '-e': '--entryDirectory',
      '-i': '--individual'
    },
    {
      argv: rawArgs.slice(2),
    }
  )
  
  return {
    help: args['--help'] || false,
    version: args['--version'] || false,
    map: args['--map'] || false,
    outputDirectory: args['--outputDirectory'] || './dist',
    entryDirectory: args['--entryDirectory'] || '',
    individual: args['--individual'] || false,
  }
}

async function promptForMissingOptions (options) {
  const questions = []
  
  if (!options.entryDirectory) questions.push({
    type: 'input',
    name: 'entryDirectory',
    message: 'Provide the relative path to the entry point',
    validate: async (ans) => {
      const files = await readdir(ans)
      if (!files.length) return 'Please select a directory with at least 1 file'
      return true
    }
  })
  
  if (!options.individual) questions.push({
    type: 'confirm',
    name: 'individual',
    message: 'Transform each individual file separately?',
    default: true
  })
  
  if (!options.map) questions.push({
    type: 'confirm',
    name: 'map',
    message: 'Include sourcemap(s)?',
    default: true
  })
  
  if (!questions.length) return options
  
  logStatus.info('Collecting missing required information')
  const answers = await inquirer.prompt(questions)
  
  return {
    ...options,
    ...answers,
  }
}

function createTasks (finalizedOptions) {
  return new Listr([
    {
      title: 'Create webpack configuration',
      task: (ctx) => createConfig(finalizedOptions)
        .then((path) => ctx.configPath = path)
    },
    {
      title: 'Transpile and Minifiy file(s)',
      task: (ctx, task) => exec('yarn webpack --config ' + ctx.configPath)
          .catch((err) => {
            // If the issue is not related to yarn, then continue to throw the error to stop the next task from proceeding
            logStatus.error(err)
            if (err.search(/yarn/i) === -1) {
              logStatus.error(err)
              throw err
            }
            
            ctx.yarn = false
            task.skip('Yarn not available, install it via `npm install -g yarn`')
          })
    },
    {
        title: 'Transpile and Minify file(s) with npm',
        enabled: ctx => ctx.yarn === false,
        task: () => exec('npm webpack --config ' + ctx.configPath)
    },
    {
      title: 'Remove temporary config files',
      task: (ctx) => exec('rm ' + ctx.configPath)
    }
  ])
}
