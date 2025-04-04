import { Util, DataFactory, Quad } from 'n3'
import { faker } from '@faker-js/faker'
import { OntologyClass, OntologyObjectProperty } from 'ontology-database'
import { OntologyDataProperty } from './index.js'

const { isNamedNode, isLiteral } = Util
const { quad, namedNode, literal } = DataFactory

const QuadType = {
  Class: 'Class',
  SubClass: 'SubClass',
  Label: 'Label',
  Comment: 'Comment',
  Other: 'Other',
  Thing: 'Thing',
  A: 'A',
}
const OntologyType = {
  Class: 'Class',
  DatatypeProperty: 'DatatypeProperty',
  ObjectProperty: 'ObjectProperty',
  Other: 'Other',
}

const SpecialUri = {
  a: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
  owlClass: 'http://www.w3.org/2002/07/owl#Class',
  owl: 'http://www.w3.org/2002/07/owl#',
  owlDatatypeProperty: 'http://www.w3.org/2002/07/owl#DatatypeProperty',
  owlObjectProperty: 'http://www.w3.org/2002/07/owl#ObjectProperty',
  thing: 'http://www.w3.org/2002/07/owl#Thing',
  subClassOf: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  label: 'http://www.w3.org/2000/01/rdf-schema#label',
  comment: 'http://www.w3.org/2000/01/rdf-schema#comment',
  domain: 'http://www.w3.org/2000/01/rdf-schema#domain',
  range: 'http://www.w3.org/2000/01/rdf-schema#range',
  literal: 'http://www.w3.org/2000/01/rdf-schema#literal',
}

const SpecialNodes = {
  a: namedNode(SpecialUri.a),
  owlClass: namedNode(SpecialUri.owlClass),
  owl: namedNode(SpecialUri.owl),
  owlDatatypeProperty: namedNode(SpecialUri.owlDatatypeProperty),
  owlObjectProperty: namedNode(SpecialUri.owlObjectProperty),
  thing: namedNode(SpecialUri.thing),
  subClassOf: namedNode(SpecialUri.subClassOf),
  rdf: namedNode(SpecialUri.rdf),
  rdfs: namedNode(SpecialUri.rdfs),
  label: namedNode(SpecialUri.label),
  comment: namedNode(SpecialUri.comment),
  domain: namedNode(SpecialUri.domain),
  range: namedNode(SpecialUri.range),
  literal: namedNode(SpecialUri.literal),
}

const Schema = {
  get a() {
    return SpecialUri.a
  },
  get aNode() {
    return SpecialNodes.a
  },

  get owlClass() {
    return SpecialUri.owlClass
  },
  get owlClassNode() {
    return SpecialNodes.owlClass
  },

  get thing() {
    return SpecialUri.thing
  },
  get thingNode() {
    return SpecialNodes.thing
  },

  get subClassOf() {
    return SpecialUri.subClassOf
  },
  get subClassOfNode() {
    return SpecialNodes.subClassOf
  },

  get rdf() {
    return SpecialUri.rdf
  },
  get rdfNode() {
    return SpecialNodes.rdf
  },

  get rdfs() {
    return SpecialUri.rdfs
  },
  get rdfsNode() {
    return SpecialNodes.rdfs
  },

  get label() {
    return SpecialUri.label
  },
  get labelNode() {
    return SpecialNodes.label
  },

  get comment() {
    return SpecialUri.comment
  },
  get commentNode() {
    return SpecialNodes.comment
  },

  get datatypeProperty() {
    return SpecialUri.owlDatatypeProperty
  },
  get datatypePropertyNode() {
    return SpecialNodes.owlDatatypeProperty
  },

  get objectProperty() {
    return SpecialUri.owlObjectProperty
  },
  get objectPropertyNode() {
    return SpecialNodes.owlObjectProperty
  },

  get domain() {
    return SpecialUri.domain
  },
  get domainNode() {
    return SpecialNodes.domain
  },

  get range() {
    return SpecialUri.range
  },
  get rangeNode() {
    return SpecialNodes.range
  },

  validateNamespace(ns) {
    if (!ns) {
      throw new Error('Missing root in constructor.')
    }
    if (isNamedNode(ns)) {
      ns = ns.id
    }
    if (typeof ns !== 'string') {
      throw new Error('Root expected to be a string or node.')
    }
    if (!ns.endsWith('/')) {
      ns += '/'
    }
    return ns
  },
  /**
   * Returns the quads defining an ontology class.
   * @param rootId the root namespace
   * @param className the name of the class
   * @param parentClassName optional parent class name
   * @returns {[Quad|*, Quad|*, Quad|*]}
   */
  getClassQuads(rootId, className, parentClassName = null, label = null, comment = null) {
    rootId = this.ensureRootId(rootId)
    if (!parentClassName) {
      return [
        quad(this.toUri(rootId, className), this.aNode, this.owlClassNode),
        quad(this.toUri(rootId, className), this.subClassOfNode, this.thingNode),
        quad(
          this.toUri(rootId, className),
          this.labelNode,
          literal(!label ? this.toShortForm(rootId, className) : label),
        ),
        quad(this.toUri(rootId, className), this.commentNode, literal(!comment ? '' : comment)),
      ]
    } else {
      return [
        quad(this.toUri(rootId, className), this.aNode, this.owlClassNode),
        quad(
          this.toUri(rootId, className),
          this.subClassOfNode,
          this.toUri(rootId, parentClassName),
        ),
        quad(
          this.toUri(rootId, className),
          this.labelNode,
          literal(!label ? this.toShortForm(rootId, className) : label),
        ),
        quad(this.toUri(rootId, className), this.commentNode, literal(!comment ? '' : comment)),
      ]
    }
  },
  getDataPropertyQuads(rootUri, propertyName, domain, label = null, comment = null) {
    const result = [
      quad(this.toUri(rootUri, propertyName), this.aNode, this.datatypePropertyNode),
      quad(
        this.toUri(rootUri, propertyName),
        this.labelNode,
        literal(!label ? propertyName : label),
      ),
      quad(this.toUri(rootUri, propertyName), this.commentNode, literal(!comment ? '' : comment)),
    ]
    if (typeof domain === 'string') {
      result.push(
        quad(this.toUri(rootUri, propertyName), this.domainNode, this.toUri(rootUri, domain)),
      )
    } else if (Array.isArray(domain)) {
      domain.forEach((d) => {
        result.push(
          quad(this.toUri(rootUri, propertyName), this.domainNode, this.toUri(rootUri, d)),
        )
      })
    }
    return result
  },
  getObjectPropertyQuads(rootUri, propertyName, domain, range, label = null, comment = null) {
    const result = [
      quad(this.toUri(rootUri, propertyName), this.aNode, this.objectPropertyNode),
      // quad(this.toUri(rootUri, propertyName), this.subClassOfNode, this.objectPropertyNode),
      quad(
        this.toUri(rootUri, propertyName),
        this.labelNode,
        literal(!label ? propertyName : label),
      ),
      quad(this.toUri(rootUri, propertyName), this.commentNode, literal(!comment ? '' : comment)),
    ]
    if (typeof domain === 'string') {
      result.push(
        quad(this.toUri(rootUri, propertyName), this.domainNode, this.toUri(rootUri, domain)),
      )
    } else if (Array.isArray(domain)) {
      domain.forEach((d) => {
        result.push(
          quad(this.toUri(rootUri, propertyName), this.domainNode, this.toUri(rootUri, d)),
        )
      })
    }
    if (typeof range === 'string') {
      result.push(
        quad(this.toUri(rootUri, propertyName), this.rangeNode, this.toUri(rootUri, range)),
      )
    } else if (Array.isArray(range)) {
      range.forEach((r) => {
        result.push(quad(this.toUri(rootUri, propertyName), this.rangeNode, this.toUri(rootUri, r)))
      })
    }
    return result
  },

  getClassDetailsFromQuads(rootUri, quadArray) {
    const def = OntologyClass.serializationTemplate
    let foundQuad = quadArray.find((a) => a.predicate === this.aNode)
    if (foundQuad) {
      if (foundQuad.object !== this.owlClassNode) {
        if (foundQuad.object === this.objectPropertyNode)
          throw new Error('The given quads defines an object property rather than a class.')
        if (foundQuad.object === this.datatypePropertyNode)
          throw new Error('The given quads defines a data property rather than a class.')
        throw new Error(`The given quads define a type '${foundQuad.object}' instead of a class.`)
      }
      def.name = this.toShortForm(rootUri, foundQuad.subject)
      def.id = foundQuad.subject.id
    } else {
      throw new Error('Given quads do not define an ontology element.')
    }
    foundQuad = quadArray.find((a) => a.predicate === this.subClassOfNode)
    if (foundQuad) {
      def.parentId = foundQuad.object.id
      def.parentName = this.toShortForm(rootUri, foundQuad.object)
    }
    foundQuad = quadArray.find((a) => a.predicate === this.labelNode)
    if (foundQuad) {
      def.label = foundQuad.object.value
    }
    foundQuad = quadArray.find((a) => a.predicate === this.comment)
    if (foundQuad) {
      def.label = foundQuad.object.value
    }
    return def
  },

  getObjectPropertyDetailsFromQuads(rootUri, quadArray) {
    const def = OntologyObjectProperty.serializationTemplate
    let foundQuad = quadArray.find((a) => a.predicate === this.aNode)
    if (foundQuad) {
      if (foundQuad.object !== this.objectPropertyNode) {
        if (foundQuad.object === this.owlClassNode)
          throw new Error('The given quads defines a class rather than an object property.')
        if (foundQuad.object === this.datatypePropertyNode)
          throw new Error('The given quads defines a data property rather than an object property.')
        throw new Error(
          `The given quads define a type '${foundQuad.object}' instead of an object property.`,
        )
      }
      def.name = this.toShortForm(rootUri, foundQuad.subject)
      def.id = foundQuad.subject.id
    } else {
      throw new Error('Given quads do not define an ontology element.')
    }

    foundQuad = quadArray.filter((a) => a.predicate === this.domainNode)
    if (foundQuad) {
      def.domainIds = foundQuad.map((q) => q.object.id)
    }
    foundQuad = quadArray.filter((a) => a.predicate === this.rangeNode)
    if (foundQuad) {
      def.rangeIds = foundQuad.map((q) => q.object.id)
    }

    foundQuad = quadArray.find((a) => a.predicate === this.labelNode)
    if (foundQuad) {
      def.label = foundQuad.object.value
    }
    foundQuad = quadArray.find((a) => a.predicate === this.comment)
    if (foundQuad) {
      def.label = foundQuad.object.value
    }
    return def
  },

  getDatatypePropertyDetailsFromQuads(rootUri, quadArray) {
    const def = OntologyDataProperty.serializationTemplate
    let foundQuad = quadArray.find((a) => a.predicate === this.aNode)
    if (foundQuad) {
      if (foundQuad.object !== this.datatypePropertyNode) {
        if (foundQuad.object === this.owlClassNode)
          throw new Error('The given quads defines a class rather than a data property.')
        if (foundQuad.object === this.objectPropertyNode)
          throw new Error('The given quads defines an object property rather than a data property.')
        throw new Error(
          `The given quads define a type '${foundQuad.object}' instead of a data property.`,
        )
      }
      def.name = this.toShortForm(rootUri, foundQuad.subject)
      def.id = foundQuad.subject.id
    } else {
      throw new Error('Given quads do not define an ontology element.')
    }

    foundQuad = quadArray.filter((a) => a.predicate === this.domainNode)
    if (foundQuad) {
      def.domainIds = foundQuad.map((q) => q.object.id)
    }

    foundQuad = quadArray.find((a) => a.predicate === this.labelNode)
    if (foundQuad) {
      def.label = foundQuad.object.value
    }
    foundQuad = quadArray.find((a) => a.predicate === this.comment)
    if (foundQuad) {
      def.label = foundQuad.object.value
    }
    return def
  },

  /**
   * Returns the type of quad given.
   * @param q presumably a quad
   * @returns {string}
   */
  getQuadType: function (q) {
    if (!q) {
      throw new Error('Missing argument in getQuadType.')
    }
    if (!(q instanceof Quad)) {
      throw new Error(`getQuadType expected a Quad argument.`)
    } else if (q.predicate === SpecialNodes.owlClass) {
      return QuadType.Class
    } else if (q.predicate === SpecialNodes.comment) {
      return QuadType.Comment
    } else if (q.predicate === SpecialNodes.comment) {
      return QuadType.Comment
    } else if (q.predicate === SpecialNodes.label) {
      return QuadType.Label
    } else if (q.predicate === SpecialNodes.a) {
      return QuadType.A
    } else if (q.predicate === SpecialNodes.thing) {
      return QuadType.Thing
    }
    return QuadType.Other
  },

  /**
   * Given an array of quads this returns what it presumably serializes.
   * @param quadArray a quad array
   * @returns {string}
   */
  getOntologyTypeOfQuads(quadArray) {
    if (!quadArray) {
      throw new Error('Missing argument in getOntologyTypeOfQuads.')
    }
    if (!Array.isArray(quadArray)) {
      throw new Error('getOntologyTypeOfQuads argument should be an array of quads.')
    }
    const found = quadArray.filter((a) => a.predicate === SpecialNodes.a)
    if (found.length !== 1) {
      return OntologyType.Other
    }
    const obj = found[0].object
    if (obj === SpecialNodes.owlDatatypeProperty) {
      return OntologyType.DatatypeProperty
    } else if (obj === SpecialNodes.owlObjectProperty) {
      return OntologyType.ObjectProperty
    } else if (obj === SpecialNodes.owlClass) {
      return OntologyType.Class
    }
    return OntologyType.Other
  },

  /**
   * Returns a shortened form of the given term.
   * Useful for printing and literals.
   * @param rootUri the root namespace
   * @param uri anything
   * @returns {string}
   */
  toShortForm(rootUri, uri) {
    const rootId = this.ensureRootId(rootUri)
    if (typeof uri === 'string') {
      uri = uri
        .replace(rootId, '')
        .replace(SpecialUri.rdf, '')
        .replace(SpecialUri.rdfs, '')
        .replace(SpecialUri.owl, '')
      if (uri.indexOf('/') > -1) {
        uri = uri.slice(uri.indexOf('/') + 1)
      }
      if (uri.indexOf('#') > -1) {
        uri = uri.slice(uri.lastIndexOf('#') + 1)
      }
      return uri
    } else if (isNamedNode(uri)) {
      return this.toShortForm(rootId, uri.id)
    } else if (Array.isArray(uri)) {
      uri.map((u) => this.toShortForm(u))
    } else if (isLiteral(uri)) {
      return uri.value
    } else {
      return String(uri)
    }
  },
  /**
   * Makes sure that the given things can be used as a namespace (trailing slash and such).
   * @param rootSomething string or node
   * @returns {string}
   */
  ensureRootId(rootSomething) {
    if (!rootSomething) {
      throw new Error('Missing root Uri or Url.')
    }
    if (typeof rootSomething === 'string') {
      if (!rootSomething.startsWith('http')) {
        throw new Error(`The root '${rootSomething}' should begin with 'http' or 'https'.`)
      }
      if (rootSomething.endsWith('#')) {
        throw new Error(`The framework does not support naming based on '#', only on trailing '/'.`)
      }
      if (!rootSomething.endsWith('/')) {
        rootSomething += '/'
      }
      return rootSomething
    }
    if (isNamedNode(rootSomething)) {
      return this.ensureRootId(rootSomething.id)
    }
  },
  /**
   * Assembles a named node from the given parts.
   * @param rootUri The root namespace.
   * @param args optional parts
   * @returns {NamedNode|*}
   */
  toUri(rootUri, ...args) {
    if (!rootUri) {
      throw new Error('Missing root Uri')
    }
    let rootNode = isNamedNode(rootUri) ? rootUri : namedNode(rootUri)
    let rootId = isNamedNode(rootUri) ? rootUri.id : rootUri

    if (!rootId.startsWith('http')) {
      throw new Error(`The root Uri is not valid, it should start with 'http'.`)
    }

    if (!rootId.endsWith('/')) {
      rootId += '/'
      rootNode = namedNode(rootId)
    }
    if (args.length === 0 || !args[0]) {
      return rootNode
    }
    // case that the first arg is a NamedNode we return it as-is, allowing for non-root nodes
    if (isNamedNode(args[0])) {
      return args[0]
    }
    if (args[0].startsWith('http')) {
      // not nice to give a Url but we'll accept it
      return namedNode(args[0])
    }
    const ar = []
    args.forEach((arg) => {
      if (typeof arg !== 'string') {
        throw new Error('All Uri elements should be strings.')
      }
      if (arg.startsWith('/')) {
        arg = arg.slice(1)
      }
      if (arg.endsWith('/')) {
        arg = arg.slice(0, -1)
      }
      ar.push(arg)
    })
    return namedNode(rootId + ar.join('/'))
  },
  /**
   * Returns a random Uri for testing purposes.
   */
  get random() {
    const parent = this
    return {
      get uri() {
        return parent.toUri(faker.internet.url(), faker.lorem.word())
      },
      get classQuads() {
        return parent.getClassQuads(
          faker.internet.url(),
          faker.string.uuid(),
          null,
          faker.lorem.words(4),
          faker.lorem.paragraph(),
        )
      },
      get classQuadsAndDetails() {
        const root = faker.internet.url()
        const className = faker.string.uuid()
        const parentName = faker.string.uuid()
        const def = {
          name: className,
          uri: parent.toUri(root, className),
          label: faker.lorem.word(),
          comment: faker.lorem.paragraph(),
          parentUri: parent.toUri(root, parentName),
          parentName: parentName,
          root: root,
        }
        return {
          details: def,
          quads: parent.getClassQuads(root, def.name, def.parentName, def.label, def.comment),
        }
      },
      get datatypePropertyQuads() {
        return parent.getDataPropertyQuads(
          faker.internet.url(),
          faker.lorem.word(),
          faker.internet.domainWord(),
          faker.lorem.words(4),
          faker.lorem.paragraph(),
        )
      },
    }
  },
}

export { Schema, SpecialNodes, SpecialUri, QuadType, OntologyType }
