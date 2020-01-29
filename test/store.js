const _ = require('lodash')
const should = require('should')
const OntologyStore = require('../knwl/store')
const faker = require('faker')
const store = new OntologyStore(faker.internet.url())
const schema = require('../knwl/ontology').Schema
describe('OntologyStore', function() {
  describe('addClass', () => {
    it('should add a class', async function() {
      const className = faker.random.uuid()
      const parentClassName = faker.lorem.word()
      await store.addClass(className, parentClassName)
      const found = await store.getClassQuads(className)
      should(found).have.length(4) // gives four quads
      console.log(found)
    })
  })

  describe('getObjectPropertyQuads', () => {
    it('should get the shipCrew quads', async function() {
      // getting the shipCrew props from dbpedia
      const ns = store.rootId
      store.rootId = 'http://dbpedia.org'
      const q = await store.getObjectPropertyQuads('shipCrew')
      should(q.length).be.above(0)
      const plain = schema.getObjectPropertyDetailsFromQuads(store.rootId, q)
      console.log(plain)
      should(plain.name).be.equal('shipCrew')
      should(plain.rangeIds.length).be.equal(1)
      should(plain.domainIds.length).be.equal(1)
      // reset to the random one
      store.rootId = ns
    })
  })
})
