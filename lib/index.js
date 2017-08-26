
var mkdirp = require('mkdirp')

var processor = require('./processor')

module.exports = { process: processMermaid }

function processMermaid (files, _options, _next) {
  var options = _options || {}
  var outputDir = options.outputDir || process.cwd()
  var outputSuffix = options.outputSuffix || ''
  var next = _next || function () { }
  var phantomArgs = [
    outputDir,
    options.png,
    options.svg,
    options.css,
    options.sequenceConfig,
    options.ganttConfig,
    options.verbose,
    options.width,
    outputSuffix
  ]

  files.forEach(function (file) {
    phantomArgs.push(file)
  })

  mkdirp(outputDir, function (err) {
    if (err) {
      throw err
    }

    processor(...(phantomArgs)).then(() => next()).catch(e => next(e))
  })
}
