import { describe, expect, test } from 'vitest'
import { faker } from '@faker-js/faker'
import { DataFactory } from 'n3'
import * as path from 'node:path'
import { Knowledge } from '../src'
import { Schema, SpecialUri } from '../src/ontology'

const KnowledgeTest = Knowledge

const rootId = faker.internet.url()
const knowledge = new KnowledgeTest(rootId)

describe('Knowledge', () => {
  describe('addClass', () => {
    test('should add a class', async () => {
      const className = faker.string.uuid()
      const classId = Schema.toUri(rootId, className)
      const cls = await knowledge.addClass(className)
      const exists = await knowledge.classExists(className)
      expect(exists).toBe(true)
      expect(cls.name).toBe(className)
      expect(cls.parentName).toBe('Thing')
      expect(cls.parentId).toEqual(SpecialUri.thing)
      expect(cls.id).toEqual(classId.id)
    }, 150000)
  })

  describe('addObjectProperty', () => {
    test('should add a new property', async () => {
      const propertyName = faker.string.uuid()
      const domainName = faker.string.uuid()
      const rangeName = faker.string.uuid()
      const propId = Schema.toUri(rootId, propertyName)
      const def = {
        id: propId,
        name: propertyName,
        domain: domainName,
        range: rangeName,
      }
      const prop1 = await knowledge.addObjectProperty(def)

      const exists = await knowledge.objectPropertyExists(propertyName)
      expect(exists).toBe(true)

      const prop2 = await knowledge.getObjectProperty(propertyName)
      const j1 = prop1.toJson()
      const j2 = prop2.toJson()

      expect(j1).toEqual(j2)
    }, 150000)
  })

  describe('addDatatypeProperty', () => {
    test('should add a new property', async () => {
      const propertyName = faker.string.uuid()
      const domainName = faker.string.uuid()
      const rangeName = faker.string.uuid()
      const propId = Schema.toUri(rootId, propertyName)
      const def = {
        id: propId,
        name: propertyName,
        domain: domainName,
        range: rangeName,
        label: propertyName,
      }
      const prop1 = await knowledge.addDatatypeProperty(def)

      const exists = await knowledge.dataPropertyExists(propertyName)
      expect(exists).toBe(true)

      const prop2 = await knowledge.getDataProperty(propertyName)
      const j1 = prop1.toJson()
      const j2 = prop2.toJson()

      expect(j1).toEqual(j2)
    }, 150000)
  })

  describe('getClass', () => {
    test('should get the class', async () => {
      const className = faker.string.uuid()
      const cl1 = await knowledge.addClass(className)
      const cl2 = await knowledge.getClass(className)
      const j1 = cl1.toJson()
      const j2 = cl2.toJson()
      expect(j1).toEqual(j2)
    })
  })

  describe('getAllClassUris', () => {
    test('should get only own classes', async () => {
      const className = faker.string.uuid()
      const classId = Schema.toUri(rootId, className)
      // add in-namespace class
      await knowledge.addClass(className)
      // add out-namespace class
      const node = DataFactory.namedNode(`http://whatever.com/${faker.string.uuid()}`)
      await knowledge.addClass(node)

      const all = await knowledge.getAllClassUris(false)
      const own = await knowledge.getAllClassUris(true)

      let found = own.find((s) => s === classId.id)
      expect(found).toBeTruthy()
      // external should not be there
      found = own.find((s) => s === node.id)
      expect(found).toBeFalsy()
      // but should be in the full collection
      found = all.filter((s) => s === node.id)
      expect(found.length).toBe(1)
    })
  })
  describe('loadData', () => {
    test('should import DbPedia', async () => {
      await knowledge.clear()
      let count = await knowledge.countTriples()
      expect(count).toBe(0)
      await knowledge.loadData(path.join(__dirname, '../../data/DbPedia.ttl'))
      count = await knowledge.countTriples()
      expect(count).toBeGreaterThan(0)
      console.log(`There are now ${count} triples in the store.`)
    }, 150000)
  })

  describe('getSimplifiedObjectProperties', () => {
    test('should return the DbPedia object props', async () => {
      // let's take dbpedia since the testing namespace might not have any
      const ns = knowledge.rootId
      knowledge.rootId = 'http://dbpedia.org/'
      const props = await knowledge.getSimplifiedObjectProperties(true)
      knowledge.rootId = ns // set it back for rest of tests
      expect(Object.keys(props).length).toBeGreaterThan(0)
      console.log(`There are ${Object.keys(props).length} object properties.`)
    }, 150000)
  })

  describe('getDataPropertyUrisOfClass', () => {
    test('should return the data props', async () => {
      // let's take dbpedia since the testing namespace might not have any
      const ns = knowledge.rootId
      knowledge.rootId = 'http://dbpedia.org/ontology/'
      const props = await knowledge.getDataPropertyUrisOfClass('Person')
      knowledge.rootId = ns // set it back for rest of tests
      expect(props.length).toBeGreaterThan(0)
      expect(props.includes('http://dbpedia.org/ontology/numberOfRun')).toBeTruthy()
      console.log(props)
    }, 150000)
  })
  describe('getObjectPropertyUrisOfClass', () => {
    test('should return the object props', async () => {
      // let's take dbpedia since the testing namespace might not have any
      const ns = knowledge.rootId
      knowledge.rootId = 'http://dbpedia.org/ontology/'
      const props = await knowledge.getObjectPropertyUrisOfClass('Person')
      knowledge.rootId = ns // set it back for rest of tests
      expect(props.length).toBeGreaterThan(0)
      expect(props.includes('http://dbpedia.org/ontology/almaMater')).toBeTruthy()
      console.log(props)
    }, 150000)
  })
})
