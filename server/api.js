import express from 'express'
const router = express.Router()
import { Knowledge } from 'ontology-database'

const ontology = new Knowledge('http://dbpedia.org/ontology')

router.get('/', async (req, res) => {
  res.json(true)
})

router.post('/getClass', async (req, res) => {
  const name = req.body.className
  const includeProps = req.body.includeProps || false
  const found = await ontology.getClass(name, includeProps)
  res.json(found ? found.toJson() : null)
})

router.get('/getSimplifiedOntologyGraph', async (req, res) => {
  const found = await ontology.getSimplifiedOntologyGraph()
  res.json(found)
})

router.get('/getDataPropertyUrisOfClass', async (req, res) => {
  const name = req.body.name
  const found = await ontology.getDataPropertyUrisOfClass(name)
  res.json(found)
})
router.get('/getObjectPropertyUrisOfClass', async (req, res) => {
  const name = req.body.name
  const found = await ontology.getObjectPropertyUrisOfClass(name)
  res.json(found)
})

export default router
