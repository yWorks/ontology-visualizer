import { describe, expect, test } from 'vitest'
import { DataFactory, Util } from 'n3'
import {
  Schema as schemaTest,
  SpecialNodes as nodes,
  QuadType,
  OntologyType,
} from '../src/ontology'

const { quad, namedNode } = DataFactory
const { isNamedNode } = Util

describe('Schema', () => {
  describe('toUri', () => {
    test('should return root when no args are given', async () => {
      const uri = schemaTest.toUri('http://abc/')
      expect(isNamedNode(uri)).toBe(true)
      expect(uri.id).toEqual('http://abc/')
    })

    test('should fix the trailing slash', async () => {
      const uri = schemaTest.toUri('http://wat.com')
      expect(uri.id).toEqual('http://wat.com/')
    })

    test('should concat args', async () => {
      const uri = schemaTest.toUri('http://wat.com', 'a', 'b')
      expect(uri.id).toEqual('http://wat.com/a/b')
    })

    test('should recognize the named node root', async () => {
      const uri = schemaTest.toUri(namedNode('http://qa.com'), 'a', 'b')
      expect(uri.id).toEqual('http://qa.com/a/b')
    })
  })
  describe('quadType', () => {
    test('should return a class type', async () => {
      const q = quad(schemaTest.random.uri, nodes.owlClass, schemaTest.random.uri)
      const type = schemaTest.getQuadType(q)
      expect(type).toEqual(QuadType.Class)
    })

    test('should return an other type', async () => {
      const q = quad(schemaTest.random.uri, schemaTest.random.uri, schemaTest.random.uri)
      const type = schemaTest.getQuadType(q)
      expect(type).toEqual(QuadType.Other)
    })
  })
  describe('getOntologyTypeOfQuads', () => {
    test('should return a class ', async () => {
      const q = schemaTest.random.classQuads
      const type = schemaTest.getOntologyTypeOfQuads(q)
      expect(type).toEqual(OntologyType.Class)
    })
    test('should return a property ', async () => {
      const q = schemaTest.random.datatypePropertyQuads
      const type = schemaTest.getOntologyTypeOfQuads(q)
      expect(type).toEqual(OntologyType.DatatypeProperty)
    })
  })
  describe('getClassDetailsFromQuads', () => {
    test('should return all info ', async () => {
      const { details, quads } = schemaTest.random.classQuadsAndDetails
      const def = schemaTest.getClassDetailsFromQuads(details.root, quads)
      expect(def.id).toEqual(details.uri.id)
      expect(def.name).toEqual(details.name)
      expect(def.parentName).toEqual(details.parentName)
      expect(def.parentId).toEqual(details.parentUri.id)
    })
  })
})
