/**
 * Copies the license.json file from the 'yfiles' dependency of the 'demos/package.json' file to the 'demos' directory.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '/package.json'), 'utf8'))
const yFilesTarFile = packageJson?.dependencies?.['@yfiles/yfiles']
const destDir = path.resolve(__dirname)

if (!yFilesTarFile) {
  console.log(
    `\nyFiles license was NOT copied because the 'yfiles' dependency was not detected.` +
      `\nPlease add your own yFiles license to the demo.`,
  )
  process.exit(1)
}

const licenseFile = path.join(__dirname, path.dirname(yFilesTarFile), 'license.json')
if (!fs.existsSync(licenseFile)) {
  console.log(
    `\nyFiles license was NOT copied from '${licenseFile}' because the file does not exist.` +
      `\nPlease add your own yFiles license to the demo.`,
  )
  process.exit(1)
}

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir)
}

fs.copyFile(licenseFile, path.join(destDir, 'license.json'), (err) => {
  if (err) {
    console.log(
      `\nyFiles license was NOT copied from '${licenseFile}'.` +
        `\nPlease add your own yFiles license to the demo.`,
    )
  } else {
    console.log(`\nyFiles license was copied from '${licenseFile}'.`)
  }
})
