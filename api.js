const fs = require('fs'),
  path = require('path'),
  express = require('express'),
  router = express.Router()
const Knowledge = require('./knwl').Knowledge
const knwl = new Knowledge('http://dbpedia.org/ontology')
router.get('/', async (req, res, next) => {
  res.json(true)
})

router.post('/getClass', async (req, res, next) => {
  const name = req.body.name
  const includeProps = req.body.includeProps || false
  const found = await knwl.getClass(name, includeProps)
  res.json(found ? found.toJson() : null)
})

router.get('/getSimplifiedOntologyGraph', async (req, res, next) => {
  const found = await knwl.getSimplifiedOntologyGraph()
  res.json(found)
})

router.get('/getDataPropertyUrisOfClass', async (req, res, next) => {
  const name = req.body.name
  const found = await knwl.getDataPropertyUrisOfClass(name)
  res.json(found)
})
router.get('/getObjectPropertyUrisOfClass', async (req, res, next) => {
  const name = req.body.name
  const found = await knwl.getObjectPropertyUrisOfClass(name)
  res.json(found)
})

module.exports = router
