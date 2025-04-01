import { describe, expect, test } from 'vitest'
import { OntologyStore } from '../src/store'
import { faker } from '@faker-js/faker'
import { Schema } from '../src/ontology'

const storeTest = new OntologyStore(faker.internet.url())

describe('OntologyStore', function () {
  describe('addClass', () => {
    test('should add a class', async function () {
      const className = faker.string.uuid()
      const parentClassName = faker.lorem.word()
      await storeTest.addClass(className, parentClassName)
      const found = await storeTest.getClassQuads(className)
      expect(found.length).toBe(4) // gives four quads
      console.log(found)
    }, 150000)
  })

  describe('getObjectPropertyQuads', () => {
    test('should get the shipCrew quads', async () => {
      // getting the shipCrew props from dbpedia
      const ns = storeTest.rootId
      storeTest.rootId = 'http://dbpedia.org/ontology/'
      const q = await storeTest.getObjectPropertyQuads('shipCrew')
      expect(q.length).toBeGreaterThan(0)
      const plain = Schema.getObjectPropertyDetailsFromQuads(storeTest.rootId, q)
      console.log(plain)
      expect(plain.name).toEqual('shipCrew')
      expect(plain.rangeIds.length).toEqual(1)
      expect(plain.domainIds.length).toEqual(1)
      // reset to the random one
      storeTest.rootId = ns
    }, 150000)
  })
})
