const _ = require('lodash')
const should = require('should')
const OntologyStore = require('../knwl/store')
const store = new OntologyStore('http://swa.com/')
const ontology = require('../knwl/ontology')
const schema = ontology.Schema
const nodes = ontology.SpecialNodes
const QuadType = ontology.QuadType
const OntologyType = ontology.OntologyType
const n3 = require('n3')
const dataFactory = n3.DataFactory
const { quad, namedNode, literal, defaultGraph } = dataFactory

describe('Schema', function () {
  describe('toUri', () => {
    it('should return root when no args are given', async function () {
      const uri = schema.toUri('http://abc/')
      should(uri).instanceOf(n3.DataFactory.internal.NamedNode)
      should(uri.id).be.equal('http://abc/')
    })

    it('should fix the trailing slash', async function () {
      const uri = schema.toUri('http://wat.com')
      should(uri.id).be.equal('http://wat.com/')
    })

    it('should concat args', async function () {
      const uri = schema.toUri('http://wat.com', 'a', 'b')
      should(uri.id).be.equal('http://wat.com/a/b')
    })

    it('should recognize the named node root', async function () {
      const uri = schema.toUri(namedNode('http://qa.com'), 'a', 'b')
      should(uri.id).be.equal('http://qa.com/a/b')
    })
  })
  describe('quadType', () => {
    it('should return a class type', async function () {
      const q = quad(schema.random.uri, nodes.owlClass, schema.random.uri)
      const type = schema.getQuadType(q)
      should(type).be.equal(QuadType.Class)
    })

    it('should return an other type', async function () {
      const q = quad(schema.random.uri, schema.random.uri, schema.random.uri)
      const type = schema.getQuadType(q)
      should(type).be.equal(QuadType.Other)
    })
  })
  describe('getOntologyTypeOfQuads', () => {
    it('should return a class ', async function () {
      const q = schema.random.classQuads
      const type = schema.getOntologyTypeOfQuads(q)
      should(type).be.equal(OntologyType.Class)
    })
    it('should return a property ', async function () {
      const q = schema.random.datatypePropertyQuads
      const type = schema.getOntologyTypeOfQuads(q)
      should(type).be.equal(OntologyType.DatatypeProperty)
    })
  })
  describe('getClassDetailsFromQuads', () => {
    it('should return all info ', async function () {
      const { details, quads } = schema.random.classQuadsAndDetails
      const def = schema.getClassDetailsFromQuads(details.root, quads)
      should(def.id).be.equal(details.uri.id)
      should(def.name).be.equal(details.name)
      should(def.parentName).be.equal(details.parentName)
      should(def.parentId).be.equal(details.parentUri.id)
    })
  })
})
