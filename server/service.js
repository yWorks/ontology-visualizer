import * as path from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import createError from 'http-errors'
import express from 'express'
import cors from 'cors'
import api from './api.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(express.static(path.join(__dirname, 'public')))
const port = 3001

app.get('/', (req, res) => res.send('This is the ontology visualizer REST backend.'))
app.use('/api', api)
// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404))
})
// error handler
app.use(function (err, req, res) {
  // set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  // render the error page
  res.status(err.status || 500)
  res.send(err)
})
app.listen(port, () => console.log(`Listening on port ${port}!`))

export default app
