import { defineConfig } from 'vite'
import * as path from 'node:path'

export default defineConfig(() => {
  return {
    root: path.resolve(__dirname, `./app`),
  }
})
