/**
 * Credits:
 * - SVG Processing from the NYTimes svg-crowbar, under an MIT license
 *   https://github.com/NYTimes/svg-crowbar
 * - Thanks to the grunticon project for some guidance
 *   https://github.com/filamentgroup/grunticon
 */

var fs = require('fs')
var path = require('path')

module.exports = async function (
  outputDir,
  png,
  svg,
  cssPath,
  sequenceConfigPath,
  ganttConfigPath,
  verbose,
  width,
  outputSuffix,
  ...files
) {
  const ganttConfig = ganttConfigPath ? JSON.parse(fs.readFileSync(ganttConfigPath)) : {}
  const sequenceConfig = sequenceConfigPath ? JSON.parse(fs.readFileSync(sequenceConfigPath)) : {}

  var options = {
    outputDir: outputDir,
    png: png,
    svg: svg,
    css: fs.readFileSync(cssPath).toString(),
    verbose: true,
    width: width,
    outputSuffix: outputSuffix
  }
    var log = logger(options.verbose)

  var puppeteer = require('puppeteer')
  await puppeteer.launch().then(async browser => {
    const page = await browser.newPage()

    await page.setContent([
      '<html>',
      '<head>',
      '<style type="text/css">body {background:white;font-family: Arial;}',
      options.css,
      '</style>',
      '</head>',
      '<body>',
      '</body>',
      '</html>'
    ].join('\n'))
    await page.injectFile('dist/mermaid.js')
    page.on('console', (...args) => {
      if(options.verbose)console.log(...args)
    })
    sequenceConfig.useMaxWidth = false

    log('Num files to execute : ' + files.length)


    if (typeof width === 'undefined' || width === 'undefined') {
      width = 1200
    }

    for (let file of files) {
      var contents = fs.readFileSync(file).toString()
      var filename = path.basename(file)

      log('ready to execute: ' + file)

      // this JS is executed in this statement is sandboxed, even though it doesn't
      // look like it. we need to serialize then unserialize the svgContent that's
      // taken from the DOM
      const svgContent = await page.evaluate(executeInPage, {
        contents: contents,
        ganttConfig: ganttConfig,
        sequenceConfig: sequenceConfig,
        confWidth: width
      })
      const viewport = await page.evaluate((svg, css) => {
        var oParser = new window.DOMParser()
        window.oDOM = oParser.parseFromString(svg, 'text/xml')
        resolveSVGElement(window.oDOM.firstChild)
        setSVGStyle(window.oDOM.firstChild)

        function resolveSVGElement (element) {
          var prefix = {
            xmlns: 'http://www.w3.org/2000/xmlns/',
            xlink: 'http://www.w3.org/1999/xlink',
            svg: 'http://www.w3.org/2000/svg'
          }

          element.setAttribute('version', '1.1')
          // removing attributes so they aren't doubled up
          element.removeAttribute('xmlns')
          element.removeAttribute('xlink')
          // These are needed for the svg
          if (!element.hasAttributeNS(prefix.xmlns, 'xmlns')) {
            element.setAttributeNS(prefix.xmlns, 'xmlns', prefix.svg)
          }
          if (!element.hasAttributeNS(prefix.xmlns, 'xmlns:xlink')) {
            element.setAttributeNS(prefix.xmlns, 'xmlns:xlink', prefix.xlink)
          }
        }

        function setSVGStyle (svg, css) {
          if (!css || !svg) { return }
          var styles = svg.getElementsByTagName('style')
          if (!styles || styles.length === 0) { return }
          styles[0].textContent = css
        }

        return {
          width: ~~window.oDOM.documentElement.attributes.getNamedItem('width').value,
          height: ~~window.oDOM.documentElement.attributes.getNamedItem('height').value
        }
      }, svgContent, options.css)

      await page.setViewport(viewport)
      var outputPath = options.outputDir + path.sep + filename + options.outputSuffix
      if (options.png) {
        console.log(outputPath)
        await page.screenshot({ path: outputPath + '.png' })
        log('saved png: ' + outputPath + '.png')
      }

      if (options.svg) {
        const svg = await page.evaluate(() => {
          var serialize = new window.XMLSerializer()
          return serialize.serializeToString(window.oDOM) + '\n'
        })
        fs.writeFileSync(outputPath + '.svg', svg)
        log('saved svg: ' + outputPath + '.svg')
      }
    }
    browser.close()
  })
}

function logger (_verbose) {
  var verbose = _verbose

  return function (_message, _level) {
    var level = _level
    var message = _message
    var log

    log = level === 'error' ? console.error : console.log

    if (verbose) {
      log(message)
    }
  }
}
// The sandboxed function that's executed in-page by phantom
function executeInPage (data) {
  var xmlSerializer = new window.XMLSerializer()
  var contents = data.contents
  var sequenceConfig = JSON.stringify(data.sequenceConfig)
  var ganttConfig = JSON.stringify(data.ganttConfig).replace(/"(function.*})"/, '$1')
  var svg
  var svgValue
  var boundingBox
  var width
  var height
  var confWidth = data.confWidth

  var toRemove = document.getElementsByClassName('mermaid')
  if (toRemove && toRemove.length) {
    for (var i = 0, len = toRemove.length; i < len; i++) {
      toRemove[i].parentNode.removeChild(toRemove[i])
    }
  }

  var el = document.createElement('div')
  el.className = 'mermaid'
  el.appendChild(document.createTextNode(contents))
  document.body.appendChild(el)

  var config = {
    sequenceDiagram: JSON.parse(sequenceConfig),
    flowchart: { useMaxWidth: false },
    logLevel: 1
  }

  window.mermaid.initialize(config)

  var sc = document.createElement('script')
  sc.appendChild(document.createTextNode('mermaid.ganttConfig = ' + ganttConfig + ';'))
  document.body.appendChild(sc)

  window.mermaid.init()

  svg = document.querySelector('svg')

  boundingBox = svg.getBoundingClientRect() // the initial bonding box of the svg
  width = boundingBox.width * 1.5 // adding the scale factor for consistency with output in chrome browser
  height = boundingBox.height * 1.5 // adding the scale factor for consistency with output in chrome browser

  var scalefactor = confWidth / (width - 8)

  // resizing the body to fit the svg
  document.body.setAttribute(
    'style'
    , 'width: ' + (confWidth - 8) + '; height: ' + (height * scalefactor) + ';'
  )
  // resizing the svg via css for consistent display
  svg.setAttribute(
    'style'
    , 'width: ' + (confWidth - 8) + '; height: ' + (height * scalefactor) + ';'
  )

  // set witdth and height attributes used to set the viewport when rending png image
  svg.setAttribute(
    'width'
    , confWidth
  )
  svg.setAttribute(
    'height'
    , height * scalefactor
  )

  svgValue = xmlSerializer.serializeToString(svg) + '\n'
  return svgValue
}
