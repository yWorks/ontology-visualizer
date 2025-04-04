import { Schema, OntologyType, SpecialUri } from './ontology.js'
import { OntologyStore } from './store.js'
import { Util } from 'n3'

const { isNamedNode } = Util

/**
 * Ontology and knowledge manager which transparently handles the data management on triple level.
 */
class Knowledge {
  /**
   * Instantiates a new sample-database manager with the given namespace.
   * @param rootId namespace uri or node.
   */
  constructor(rootId) {
    this._rootId = Schema.ensureRootId(rootId)
    this.store = new OntologyStore(this.rootId)
  }

  /**
   * Sets the root namespace of this sample-database manager.
   * @returns {string}
   */
  get rootId() {
    return this._rootId
  }

  /**
   * Sets the root namespace of this sample-database manager.
   * @param v the uri of the new namespace.
   */
  set rootId(v) {
    this._rootId = Schema.ensureRootId(v)
    // push down to the actual store
    this.store.rootId = this._rootId
  }

  /**
   * Returns the data properties of the specified class.
   * @param className name, uri or node of a class
   * @returns {Promise<Array>}
   */
  getDataPropertyUrisOfClass(className) {
    return this.store.getDataPropertyUrisOfClass(className)
  }

  /**
   * Returns the object properties of the specified class.
   * @param className name, uri or node of a class
   * @returns {Promise<Array>}
   */
  getObjectPropertyUrisOfClass(className) {
    return this.store.getObjectPropertyUrisOfClass(className)
  }

  /**
   * Adds an ontology class.
   * @param opts name or definition.
   * @returns { Promise<OntologyClass>}
   */
  async addClass(opts) {
    let def
    if (typeof opts === 'string') {
      await this.store.addClass(opts)
      def = OntologyClass.serializationTemplate
      def.name = opts
      def.id = Schema.toUri(this.rootId, opts).id
    } else if (isNamedNode(opts)) {
      await this.store.addClass(opts)
      def = OntologyClass.serializationTemplate
      def.name = Schema.toShortForm(this.rootId, opts)
      def.id = opts
    } else if (isPlainObject(opts)) {
      if (!opts.name || !opts.className) {
        throw new Error("Class definition should contain 'name' or 'className'.")
      }
      const className = opts.name || opts.className
      if (isNamedNode(className)) {
        throw new Error(
          'When using a plain object to create an OntologyClass the class name should be a string.',
        )
      }
      if (!className) {
        throw new Error('The class name cannot be nil.')
      }
      let parentClassName = null
      if (opts.parentName || opts.parentClassName) {
        parentClassName = opts.parentName || opts.parentClassName
      }
      if (isNamedNode(parentClassName)) {
        throw new Error(
          'When using a plain object to create an OntologyClass the parent class name should be a string.',
        )
      }

      let label = null
      if (opts.label) {
        label = opts.label
      }
      let comment = null
      if (opts.comment) {
        comment = opts.comment
      }
      try {
        await this.store.addClass(className, parentClassName, label, comment)
      } catch (e) {
        console.error(e)
      }
      def = OntologyClass.serializationTemplate
      def.name = className
      def.id = Schema.toUri(this.rootId, className).id
      def.label = label
      def.comment = comment
      def.parentId = !parentClassName ? null : Schema.toUri(parentClassName).id
      def.parentName = parentClassName
    }
    return Promise.resolve(new OntologyClass(this.rootId, def))
  }

  /**
   * Returns the ontology class with the given name.
   * @param className name, uri or node
   * @returns {Promise<null|OntologyClass>}
   */
  async getClass(className, includeProperties = false) {
    const quads = await this.store.getClassQuads(className)
    if (!quads || quads.length === 0) {
      return null
    }
    if (includeProperties) {
      const cls = new OntologyClass(this.rootId, quads)
      const dataProps = await this.getDataPropertyUrisOfClass(className)
      const objectProps = await this.getObjectPropertyUrisOfClass(className)
      if (!dataProps || dataProps.length === 0) {
        cls.dataProperties = []
      } else {
        cls.dataProperties = dataProps.map((d) => {
          return {
            name: Schema.toShortForm(this.rootId, d),
            uri: d,
          }
        })
      }
      if (!objectProps || objectProps.length === 0) {
        cls.objectProperties = []
      } else {
        cls.objectProperties = objectProps.map((d) => {
          return {
            name: Schema.toShortForm(this.rootId, d),
            uri: d,
          }
        })
      }
      return cls
    } else {
      return new OntologyClass(this.rootId, quads)
    }
  }

  /**
   * Returns the object property with the given name.
   * @param propertyName
   * @returns {Promise<OntologyObjectProperty>}
   */
  async getObjectProperty(propertyName) {
    const quads = await this.store.getObjectPropertyQuads(propertyName)
    if (!quads || quads.length === 0) {
      return null
    }
    return new OntologyObjectProperty(this.rootId, quads)
  }

  /**
   * Returns the data property with the given name.
   * @param propertyName
   * @returns {Promise<OntologyDataProperty>}
   */
  async getDataProperty(propertyName) {
    const quads = await this.store.getDataPropertyQuads(propertyName)
    if (!quads || quads.length === 0) {
      return null
    }
    return new OntologyDataProperty(this.rootId, quads)
  }

  /**
   * Returns whether the class name exists.
   * @param className name or Uri
   * @returns {Promise<boolean>}
   */
  classExists(className) {
    return this.store.classExists(className)
  }

  objectPropertyExists(propertyName) {
    return this.store.objectPropertyExists(propertyName)
  }

  dataPropertyExists(propertyName) {
    return this.store.dataPropertyExists(propertyName)
  }

  /**
   * Returns an array of all the ontology classes in the store.
   * @param onlyOwn include only the classes from the root namespace
   * @returns {Promise<Array>}
   */
  getAllClassUris(onlyOwn = true) {
    return this.store.getClassUris(onlyOwn)
  }

  /**
   * Returns a graph (in json format) containing the Uris of the classes and the object properties.
   * Data properties, labels and comments are not included.
   */
  getSimplifiedOntologyGraph() {
    return this.store.getSimplifiedOntologyGraph()
  }

  /**
   * Clear the triple store.
   * @returns {*|Promise<unknown>}
   */
  clear() {
    return this.store.clear()
  }

  /**
   * Imports the data in the triple store.
   * @param dataPath path to an RDF, tutrle or other triple format.
   * @returns {*|Promise|Promise<unknown>|undefined}
   */
  loadData(dataPath) {
    return this.store.loadFileData(dataPath)
  }

  /**
   * Returns the triple count.
   * @returns {Promise<number>}
   */
  countTriples() {
    return this.store.countTriples()
  }

  /**
   * Returns all object properties of the current namespace
   * as an array of graph links (plain objects with uri, from and to).
   * @param onlyOwn include only the elements from the root namespace
   * @returns {Promise<[]>}
   */
  getSimplifiedObjectProperties(onlyOwn = true) {
    return this.store.getSimplifiedObjectProperties(onlyOwn)
  }

  async addObjectProperty(opts) {
    let def
    if (typeof opts === 'string') {
      await this.store.addObjectProperty(opts)
      def = OntologyObjectProperty.serializationTemplate
      def.name = opts
      def.id = Schema.toUri(this.rootId, opts).id
    } else if (isPlainObject(opts)) {
      if (!opts.name && !opts.propertyName) {
        throw new Error("Object property definition should contain 'name' or 'propertyName'.")
      }
      const propertyName = opts.name || opts.propertyName
      if (isNamedNode(propertyName)) {
        throw new Error(
          'When using a plain object to create an object property the name should be a string.',
        )
      }
      if (!propertyName) {
        throw new Error('The property name cannot be nil.')
      }
      let domainName = null
      if (opts.domainName || opts.domain) {
        domainName = opts.domainName || opts.domain
      }
      if (!domainName) {
        throw new Error(`Missing 'domain' in object property definition.`)
      }
      let rangeName = null
      if (opts.rangeName || opts.range) {
        rangeName = opts.rangeName || opts.range
      }
      if (!rangeName) {
        throw new Error(`Missing 'range' in object property definition.`)
      }

      let label = null
      if (opts.label) {
        label = opts.label
      }
      let comment = null
      if (opts.comment) {
        comment = opts.comment
      }
      try {
        await this.store.addObjectProperty(propertyName, domainName, rangeName, label, comment)
      } catch (e) {
        console.error(e)
      }
      def = OntologyObjectProperty.serializationTemplate
      def.name = propertyName
      def.id = Schema.toUri(this.rootId, propertyName).id
      def.label = label
      def.comment = comment
      def.domainIds = !domainName ? [] : [Schema.toUri(this.rootId, domainName).id]
      def.rangeIds = !rangeName ? [] : [Schema.toUri(this.rootId, rangeName).id]
    }
    return Promise.resolve(new OntologyObjectProperty(this.rootId, def))
  }

  async addDatatypeProperty(opts) {
    let def
    if (typeof opts === 'string') {
      await this.store.addDatatypeProperty(opts)
      def = OntologyDataProperty.serializationTemplate
      def.name = opts
      def.id = Schema.toUri(this.rootId, opts).id
    } else if (isPlainObject(opts)) {
      if (!opts.name && !opts.propertyName) {
        throw new Error("Data property definition should contain 'name' or 'propertyName'.")
      }
      const propertyName = opts.name || opts.propertyName
      if (isNamedNode(propertyName)) {
        throw new Error(
          'When using a plain object to create a data property the name should be a string.',
        )
      }
      if (!propertyName) {
        throw new Error('The property name cannot be nil.')
      }
      let domainName = null
      if (opts.domainName || opts.domain) {
        domainName = opts.domainName || opts.domain
      }
      if (!domainName) {
        throw new Error(`Missing 'domain' in object property definition.`)
      }

      let label = null
      if (opts.label) {
        label = opts.label
      }
      let comment = null
      if (opts.comment) {
        comment = opts.comment
      }
      try {
        await this.store.addDatatypeProperty(propertyName, domainName, label, comment)
      } catch (e) {
        console.error(e)
      }
      def = OntologyDataProperty.serializationTemplate
      def.name = propertyName
      def.id = Schema.toUri(this.rootId, propertyName).id
      def.label = label
      def.comment = comment
      def.domainIds = !domainName ? [] : [Schema.toUri(this.rootId, domainName).id]
    }
    return Promise.resolve(new OntologyDataProperty(this.rootId, def))
  }
}

class OntologyElement {
  constructor(rootId, opts) {
    this.rootId = Schema.validateNamespace(rootId)
    this.name = null
    this.id = null
    this.label = null
    this.comment = null
    this.isLoaded = false
    if (isPlainObject(opts)) {
      this.name = opts.name
      this.id = opts.uri
      this.label = opts.label
      this.comment = opts.comment
    }
  }

  /**
   * Returns an empty OntologyElement as a plain object.
   * @returns {Object}
   */
  static get serializationTemplate() {
    return {
      name: null,
      id: null,
      label: null,
      comment: null,
    }
  }
}

class OntologyClass extends OntologyElement {
  /**
   * Creates a new instance.
   * @param opts a class name, quads defining the class or plain object.
   */
  constructor(rootId, opts = null) {
    super(rootId, opts)
    this.parentId = null
    this.parentName = null
    this.dataProperties = []
    this.objectProperties = []
    if (Array.isArray(opts) && opts.length > 0) {
      //quads
      if (Schema.getOntologyTypeOfQuads(opts) === OntologyType.Class) {
        const def = Schema.getClassDetailsFromQuads(this.rootId, opts)
        Object.assign(this, def)
      } else {
        throw new Error(
          "Given quad array is not a serialization of a class and can't hydrate class.",
        )
      }
    } else if (isPlainObject(opts)) {
      Object.assign(this, opts)
    } else if (typeof opts === 'string') {
      this.name = opts
    }
    // if nothing sets the label we'll infer it
    if (!this.label) {
      this.label = Schema.toShortForm(rootId, this.name)
    }
    // same for the parent
    if (!this.parentId) {
      this.parentId = SpecialUri.thing
      this.parentName = 'Thing'
    }
  }

  toJson() {
    return Object.assign(OntologyClass.serializationTemplate, this)
  }

  /**
   * Returns an empty OntologyClass as a plain object.
   * @returns {Object}
   */
  static get serializationTemplate() {
    const base = super.serializationTemplate

    return Object.assign(
      {
        parentId: null,
        parentName: null,
        dataProperties: [],
        objectProperties: [],
      },
      super.serializationTemplate,
    )
  }
}

class OntologyDataProperty extends OntologyElement {
  /**
   * Creates a new instance.
   * @param opts a property name, quads defining the property or plain object.
   */
  constructor(rootId, opts = null) {
    super(rootId, opts)
    this.domainIds = []
    if (Array.isArray(opts) && opts.length > 0) {
      //quads
      if (Schema.getOntologyTypeOfQuads(opts) === OntologyType.DatatypeProperty) {
        const def = Schema.getDatatypePropertyDetailsFromQuads(rootId, opts)
        Object.assign(this, def)
      } else {
        throw new Error(
          "Given quad array is not a serialization of a data property and can't hydrate instance.",
        )
      }
    } else if (isPlainObject(opts)) {
      Object.assign(this, opts)
    } else if (typeof opts === 'string') {
      this.name = opts
    }
  }

  toJson() {
    return Object.assign(OntologyDataProperty.serializationTemplate, this)
  }

  /**
   * Returns an empty OntologyObjectProperty as a plain object.
   * @returns {Object}
   */
  static get serializationTemplate() {
    return Object.assign(
      {
        rangeIds: null,
        domainIds: null,
      },
      super.serializationTemplate,
    )
  }
}

class OntologyObjectProperty extends OntologyElement {
  /**
   * Creates a new instance.
   * @param opts a property name, quads defining the property or plain object.
   */
  constructor(opts = null) {
    super(opts)
    this.rangeIds = []
    this.domainIds = []
    if (Array.isArray(opts) && opts.length > 0) {
      //quads
      if (Schema.getOntologyTypeOfQuads(opts) === OntologyType.ObjectProperty) {
        const def = Schema.getObjectPropertyDetailsFromQuads(opts)
        Object.assign(this, def)
      } else {
        throw new Error(
          "Given quad array is not a serialization of an object property and can't hydrate instance.",
        )
      }
    } else if (isPlainObject(opts)) {
      Object.assign(this, opts)
    } else if (typeof opts === 'string') {
      this.name = opts
    }
  }

  toJson() {
    return Object.assign(OntologyObjectProperty.serializationTemplate, this)
  }

  /**
   * Returns an empty OntologyObjectProperty as a plain object.
   * @returns {Object}
   */
  static get serializationTemplate() {
    return Object.assign(
      {
        rangeIds: null,
        domainIds: null,
      },
      super.serializationTemplate,
    )
  }
}

function isPlainObject(value) {
  return (
    value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype
  )
}

export { OntologyClass, OntologyDataProperty, OntologyObjectProperty, Knowledge }
