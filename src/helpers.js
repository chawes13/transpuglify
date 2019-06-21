const chalk = require('chalk')
const { exec: execute } = require('child_process')
const { promisify } = require('util')

const execP = promisify(execute)

const logStatus = {
  info: (message) => console.log(`%s ${message}`, chalk.blue.bold('INFO')),
  error: (message) => console.log(`%s ${message}`, chalk.red.bold('ERROR')),
  success: (message) => console.log(`%s ${message}`, chalk.green.bold('DONE')),
  warning: (message) => console.log(`%s ${message}`, chalk.yellow.bold('WARNING'))
}

// Execute commands asynchronously via Promises
function exec (command) {
  return execP(command, { stdio: 'inherit' })
}

module.exports = {
  logStatus,
  exec
}
