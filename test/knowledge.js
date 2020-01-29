const _ = require('lodash')
const should = require('should')
const OntologyStore = require('../knwl/store')
const faker = require('faker')
const n3 = require('n3')
const dataFactory = n3.DataFactory
const { quad, namedNode, literal, defaultGraph } = dataFactory
const path = require('path')
const knwl = require('../knwl')
const Knowledge = knwl.Knowledge
const schema = require('../knwl/ontology').Schema

const rootId = faker.internet.url()
const knowledge = new Knowledge(rootId)
describe('Knowledge', function() {
  this.timeout(150000)
  describe('addClass', () => {
    it('should add a class', async function() {
      const className = faker.random.uuid()
      const classId = schema.toUri(rootId, className)
      const cls = await knowledge.addClass(className)
      const exists = await knowledge.classExists(className)
      should(exists).be.exactly(true)
      should(cls.name).be.exactly(className)
      should(cls.parentName).be.equal('Thing')
      should(cls.parentId).be.equal(SpecialUri.thing)
      should(cls.id).be.equal(classId.id)
    })
  })

  describe('addObjectProperty', () => {
    it('should add a new property', async function() {
      const propertyName = faker.random.uuid()
      const domainName = faker.random.uuid()
      const rangeName = faker.random.uuid()
      const propId = schema.toUri(rootId, propertyName)
      const def = {
        name: propertyName,
        domain: domainName,
        range: rangeName
      }
      const prop1 = await knowledge.addObjectProperty(def)

      const exists = await knowledge.objectPropertyExists(propertyName)
      should(exists).be.exactly(true)

      const prop2 = await knowledge.getObjectProperty(propertyName)
      const j1 = prop1.toJson()
      const j2 = prop1.toJson()

      should(j1).be.deepEqual(j2)
    })
  })

  describe('addDatatypeProperty', () => {
    it('should add a new property', async function() {
      const propertyName = faker.random.uuid()
      const domainName = faker.random.uuid()
      const rangeName = faker.random.uuid()
      const propId = schema.toUri(rootId, propertyName)
      const def = {
        name: propertyName,
        domain: domainName
      }
      const prop1 = await knowledge.addDatatypeProperty(def)

      const exists = await knowledge.dataPropertyExists(propertyName)
      should(exists).be.exactly(true)

      const prop2 = await knowledge.getDataProperty(propertyName)
      const j1 = prop1.toJson()
      const j2 = prop1.toJson()

      should(j1).be.deepEqual(j2)
    })
  })

  describe('getClass', () => {
    it('should get the class', async function() {
      const className = faker.random.uuid()
      const classId = schema.toUri(rootId, className)
      const cl1 = await knowledge.addClass(className)
      const cl2 = await knowledge.getClass(className)
      const j1 = cl1.toJson()
      const j2 = cl2.toJson()
      should(j1).be.deepEqual(j2)
    })
  })

  describe('getAllClassUris', () => {
    it('should get only own classes', async function() {
      const className = faker.random.uuid()
      const classId = schema.toUri(rootId, className)
      // add in-namespace class
      await knowledge.addClass(className)
      // add out-namespace class
      const node = namedNode(`http://whatever.com/${faker.random.uuid()}`)
      await knowledge.addClass(node)

      const all = await knowledge.getAllClassUris(false)
      const own = await knowledge.getAllClassUris(true)

      let found = _.find(own, s => s === classId.id)
      should(found).be.ok()
      // external should not be there
      found = _.find(own, s => s === node.id)
      should(found).not.be.ok()
      // but should be in the full collection
      found = _.filter(all, s => s === node.id)
      should(found.length).be.exactly(1)
    })
  })
  describe('loadData', () => {
    it('should import DbPedia', async function() {
      await knowledge.clear()
      let count = await knowledge.countTriples()
      should(count).be.exactly(0)
      await knowledge.loadData(path.join(__dirname, '../data/DbPedia.ttl'))
      count = await knowledge.countTriples()
      should(count).be.above(0)
      console.log(`There are now ${count} triples in the store.`)
    })
  })

  describe('getSimplifiedObjectProperties', () => {
    it('should return the DbPedia object props', async function() {
      // let's take dbpedia since the testing namespace might not have any
      const ns = knowledge.rootId
      knowledge.rootId = 'http://dbpedia.org/'
      const props = await knowledge.getSimplifiedObjectProperties(true)
      knowledge.rootId = ns // set it back for rest of tests
      should(Object.keys(props).length).be.above(0)
      console.log(`There are ${Object.keys(props).length} object properties.`)
    })
  })

  describe('getDataPropertyUrisOfClass', () => {
    it('should return the data props', async function() {
      // let's take dbpedia since the testing namespace might not have any
      const ns = knowledge.rootId
      knowledge.rootId = 'http://dbpedia.org/'
      const props = await knowledge.getDataPropertyUrisOfClass('Person')
      knowledge.rootId = ns // set it back for rest of tests
      should(props.length).be.above(0)
      should(_.includes(props, 'http://dbpedia.org/numberOfRun')).be.ok()
      console.log(props)
    })
  })
  describe('getObjectPropertyUrisOfClass', () => {
    it('should return the object props', async function() {
      // let's take dbpedia since the testing namespace might not have any
      const ns = knowledge.rootId
      knowledge.rootId = 'http://dbpedia.org/'
      const props = await knowledge.getObjectPropertyUrisOfClass('Person')
      knowledge.rootId = ns // set it back for rest of tests
      should(props.length).be.above(0)
      should(_.includes(props, 'http://dbpedia.org/almaMater')).be.ok()
      console.log(props)
    })
  })
})
