/**
 * Copies the license.json file from the 'yfiles' dependency of the 'demos/package.json' file to the 'demos' directory.
 */

const fs = require('fs')
const path = require('path')
const demosDir = process.cwd()

const packageJson = require(path.join(demosDir, '/package.json'))
const yFilesTarFile =
  packageJson && packageJson.dependencies ? packageJson.dependencies.yfiles : null
const destDir = path.join(__dirname, 'app', 'yfiles')

if (!yFilesTarFile) {
  console.log(
    `\nyFiles license was NOT copied because the 'yfiles' dependency was not detected.` +
      `\nPlease add your own yFiles license to the demo.`
  )
  return
}

const licenseFile = path.join(demosDir, path.dirname(yFilesTarFile), 'lib', 'license.json')
if (!fs.existsSync(licenseFile)) {
  console.log(
    `\nyFiles license was NOT copied from '${licenseFile}' because the file does not exist.` +
      `\nPlease add your own yFiles license to the demo.`
  )
  return
}

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir)
}

fs.copyFile(licenseFile, path.join(destDir, 'license.json'), err => {
  if (err) {
    console.log(
      `\nyFiles license was NOT copied from '${licenseFile}'.` +
        `\nPlease add your own yFiles license to the demo.`
    )
  } else {
    console.log(`\nyFiles license was copied from '${licenseFile}'.`)
  }
})
