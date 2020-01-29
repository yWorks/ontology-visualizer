const createError = require('http-errors')
const express = require('express')
const path = require('path')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const api = require('./api')

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))
const port = 3001

app.get('/', (req, res) => res.send('This is the ontology visualizer REST backend.'))
app.use('/api', api)
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404))
})
// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  // render the error page
  res.status(err.status || 500)
  res.send(err)
})
app.listen(port, () => console.log(`Listening on port ${port}!`))

module.exports = app
