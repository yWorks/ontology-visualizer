const _ = require('lodash')
const should = require('should')
const OntologyStore = require('../knwl/store')
const faker = require('faker')
const n3 = require('n3')
const dataFactory = n3.DataFactory
const { quad, namedNode, literal, defaultGraph } = dataFactory

const knwl = require('../knwl')
const Knowledge = knwl.Knowledge
const OntologyClass = knwl.OntologyClass
const schema = require('../knwl/ontology').Schema

const rootId = faker.internet.url()
const knowledge = new Knowledge(rootId)
describe('Elements', function () {
  this.timeout(15000)
  describe('OntologyClass', () => {
    it('serialize', async function () {
      const className = faker.lorem.word()
      const cl = new OntologyClass(rootId, className)
      const obj = cl.toJson()
      should(obj.id).be.equal(null)
      should(obj.name).be.equal(className)
    })
  })
})
