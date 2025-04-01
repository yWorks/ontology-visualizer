import { describe, expect, test } from 'vitest'
import { faker } from '@faker-js/faker'
import { OntologyClass } from '../src'

const rootId = faker.internet.url()
describe('Elements', () => {
  describe('OntologyClass', () => {
    test('serialize', async function () {
      const className = faker.lorem.word()
      const cl = new OntologyClass(rootId, className)
      const obj = cl.toJson()
      expect(obj.id).toEqual(null)
      expect(obj.name).toEqual(className)
    }, 15000)
  })
})
