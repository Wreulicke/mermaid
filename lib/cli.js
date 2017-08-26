var fs = require('fs')
var chalk = require('chalk')
var parseArgs = require('minimist')
var path = require('path')

var info = chalk.blue.bold

module.exports = (function () {
  return new Cli()
}())

function Cli (options) {
  this.options = {
    alias: {
      help: 'h',
      png: 'p',
      outputDir: 'o',
      outputSuffix: 'O',
      svg: 's',
      verbose: 'v',
      sequenceConfig: 'c',
      ganttConfig: 'g',
      css: 't',
      width: 'w'
    },
    'boolean': ['help', 'png', 'svg', 'verbose'],
    'string': ['outputDir', 'outputSuffix']
  }

  this.errors = []
  this.message = null

  this.helpMessage = [
    info('Usage: mermaid [options] <file>...'),
    '',
    'file    The mermaid description file to be rendered',
    '',
    'Options:',
    '  -s --svg             Output SVG instead of PNG (experimental)',
    '  -p --png             If SVG was selected, and you also want PNG, set this flag',
    '  -o --outputDir       Directory to save files, will be created automatically, defaults to `cwd`',
    "  -O --outputSuffix    Suffix to output filenames in front of '.svg' or '.png', defaults to ''",
    '  -t --css             Specify the path to a CSS file to be included when processing output',
    '  -c --sequenceConfig  Specify the path to the file with the configuration to be applied in the sequence diagram',
    '  -g --ganttConfig     Specify the path to the file with the configuration to be applied in the gantt diagram',
    '  -h --help            Show this message',
    '  -v --verbose         Show logging',
    '  -w --width           width of the generated png (number)',
    '  --version            Print version and quit'
  ]

  return this
}

Cli.prototype.parse = function (argv, next) {
  this.errors = [] // clear errors
  var options = parseArgs(argv, this.options)

  if (options.version) {
    var pkg = require('../package.json')
    this.message = '' + pkg.version
    next(null, this.message)
  } else if (options.help) {
    this.message = this.helpMessage.join('\n')
    next(null, this.message)
  } else {
    options.files = options._

    if (!options.files.length) {
      this.errors.push(new Error('You must specify at least one source file.'))
    }

    // ensure that parameter-expecting options have parameters
    ;['outputDir', 'outputSuffix', 'sequenceConfig', 'ganttConfig', 'css'].forEach(function (i) {
      if (typeof options[i] !== 'undefined') {
        if (typeof options[i] !== 'string' || options[i].length < 1) {
          this.errors.push(new Error(i + ' expects a value.'))
        }
      }
    }.bind(this))

    // set svg/png flags appropriately
    if (options.svg && !options.png) {
      options.png = false
    } else {
      options.png = true
    }

    if (options.sequenceConfig) {
      try {
        fs.accessSync(options.sequenceConfig, fs.R_OK)
      } catch (err) {
        this.errors.push(err)
      }
    } else {
      options.sequenceConfig = null
    }

    if (options.ganttConfig) {
      try {
        fs.accessSync(options.ganttConfig, fs.R_OK)
      } catch (err) {
        this.errors.push(err)
      }
    } else {
      options.ganttConfig = null
    }

    if (options.css) {
      try {
        fs.accessSync(options.css, fs.R_OK)
      } catch (err) {
        this.errors.push(err)
      }
    } else {
      options.css = path.join(__dirname, '..', 'dist', 'mermaid.css')
    }

    // set svg/png flags appropriately
    if (!options.width) {
      options.width = 1200
    }
    next(
      this.errors.length > 0 ? this.errors : null
      , this.message
      , options
    )
  }
}
