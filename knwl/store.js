const path = require('path')
const fs = require('fs')
const _ = require('lodash')
const schema = require('./ontology').Schema
const RdfStore = require('quadstore').RdfStore
const leveldown = require('leveldown')
const n3 = require('n3')
const dataFactory = n3.DataFactory
const { quad, namedNode, literal, defaultGraph } = dataFactory
const resultFormat = 'application/json'
const { isNamedNode } = n3.Util

/**
 * Simplified API to manage the quadstore ontology.
 */
class OntologyStore {
  constructor(rootId) {
    this.rootId = schema.ensureRootId(rootId)
    const dbPath = path.join(__dirname, '../database')
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath)
    }
    this.store = new RdfStore(leveldown(dbPath), { dataFactory })
  }

  /**
   * Imports the data in the triple store.
   * @param dataPath path to an RDF, tutrle or other triple format.
   * @returns {*|Promise|Promise<unknown>|undefined}
   */
  loadFileData(dataPath) {
    if (_.isNil(dataPath)) {
      throw new Error('Missing path to data file.')
    }
    if (!fs.existsSync(dataPath)) {
      throw new Error(`File '${dataPath}' does not exist.`)
    }
    const streamParser = new n3.StreamParser()
    const inputStream = fs.createReadStream(dataPath)
    try {
      return this.store.putStream(inputStream.pipe(streamParser))
    } catch (e) {
      console.error(e)
      return Promise.resolve()
    }
  }

  /**
   * Returns the triple count.
   * @param onlyOwn if true only counts the triples in the root namespace
   * @returns {Promise<number>}
   */
  async countTriples() {
    // expensive wayt to do it but it's the only one
    const found = await this.getQuads({})
    return _.isNil(found) ? 0 : found.length
  }

  /**
   * Clears the whole store.
   */
  clear() {
    return new Promise((resolve, reject) => {
      this.store
        .removeMatches(null, null, null)
        .on('error', (err) => {
          reject(err)
        })
        .on('end', (q) => {
          console.log('The store has been emptied.')
          resolve()
        })
    })
  }

  /**
   * Returns all Uri's of ontology classes.
   * @param onlyOwn include only the classes from the root namespace
   * @returns {Promise<Array>}
   */
  async getClassUris(onlyOwn = true) {
    const found = await this.getQuads({ predicate: SpecialNodes.a, object: SpecialNodes.owlClass })
    const result = []
    for (let i = 0; i < found.length; i++) {
      const uri = found[i].subject.id
      if (onlyOwn && !uri.startsWith(this.rootId)) {
        continue
      }
      result.push(uri)
    }
    return result
  }

  /**
   * Returns all object properties of the current namespace
   * as an array of graph links (plain objects with uri, from and to).
   * @param onlyOwn include only the elements from the root namespace
   * @returns {Promise<[]>}
   */
  async getSimplifiedObjectProperties(onlyOwn = true) {
    // SPARQL implementation: right thing to do but horrendously slow.
    //
    // let filter = '';
    // if (onlyOwn) {
    //     filter += `FILTER(STRSTARTS(STR(?uri), "${this.rootId}")) `;
    // }
    // let query = `SELECT ?d ?uri ?r  WHERE {
    //                             ?uri a <${schema.objectProperty}>;
    //                             <${schema.domain}> ?d.
    //                              OPTIONAL { ?uri <${schema.range}> ?ra }
    //                              bind(coalesce(?ra, 'None') as ?r)
    //                              ${filter}
    //                             }`;
    // return new Promise((resolve, reject) => {
    //     this.sparql.query(query, null, (err, result) => {
    //         if (err) {
    //             reject(err);
    //         }
    //         resolve(JSON.parse(result).map(u => {
    //             return {domain: u['?d'], uri: u['?uri'], range: u['?r']};
    //         }));
    //     });
    // });

    // rather than building up all OntologyObjectProperty classes we pick
    // up all domains and ranges
    const uris = {}
    const domainQuads = await this.getQuads({ predicate: SpecialNodes.domain })
    for (let i = 0; i < domainQuads.length; i++) {
      const q = domainQuads[i]
      const uri = q.subject.id
      const domain = q.object.id
      if (_.isNil(domain) || (onlyOwn && !uri.startsWith(this.rootId))) {
        continue
      }
      if (_.isNil(uris[uri])) {
        // we'll disentangle the multiple links below
        uris[uri] = { froms: new Set(), tos: new Set() }
      }
      uris[uri].froms.add(domain)
    }
    const rangeQuads = await this.getQuads({ predicate: SpecialNodes.range })
    for (let i = 0; i < rangeQuads.length; i++) {
      const q = rangeQuads[i]
      const uri = q.subject.id
      const range = q.object.id
      if (_.isNil(range) || (onlyOwn && !uri.startsWith(this.rootId))) {
        continue
      }
      if (_.isNil(uris[uri])) {
        uris[uri] = { froms: new Set(), tos: new Set() }
      }
      uris[uri].tos.add(range)
    }

    // disentangle the arrays
    const result = []
    _.forEach(uris, (v, k) => {
      // object properties sometimes do not define a range or domain (corrupt ontology)
      if (uris[k].froms.size === 0 || uris[k].tos.size === 0) {
        return
      }

      // to arrays
      uris[k].froms = Array.from(uris[k].froms)
      uris[k].tos = Array.from(uris[k].tos)

      // all combinations between the froms and the tos:
      for (let i = 0; i < uris[k].froms.length; i++) {
        for (let j = 0; j < uris[k].tos.length; j++) {
          const from = uris[k].froms[i]
          const to = uris[k].tos[j]
          if (onlyOwn && (!from.startsWith(this.rootId) || !to.startsWith(this.rootId))) {
            continue
          }
          result.push({
            uri: k,
            from: from,
            to: to,
          })
        }
      }
    })

    return result
  }

  /**
   * Returns the quads satisfying the given quad (SPOG) pattern.
   * @param pattern a quad pattern
   * @returns {Promise<Array>}
   */
  async getQuads(pattern) {
    const found = await this.store.get(pattern)
    if (_.isNil(found) || found.length === 0) {
      return null
    }
    return found
  }

  /**
   * Returns the first label of the specified Uri.
   * @param uri Uri of a node
   * @returns {Promise<string>}
   */
  async getFirstLabel(uri) {
    if (!(uri instanceof dataFactory.internal.NamedNode)) {
      uri = schema.toUri(this.rootId, uri)
    }
    const found = await this.getQuads({ subject: uri, predicate: SpecialNodes.label })
    if (_.isNil(found) || found.length === 0) {
      return null
    }
    return found[0].object.value
  }

  /**
   * Returns the first comment of the specified Uri.
   * @param uri Uri of a node
   * @returns {Promise<string>}
   */
  async getFirstComment(uri) {
    if (!(uri instanceof dataFactory.internal.NamedNode)) {
      uri = schema.toUri(this.rootId, uri)
    }
    const found = await this.getQuads({ subject: uri, predicate: SpecialNodes.comment })
    if (_.isNil(found) || found.length === 0) {
      return null
    }
    return found[0].value
  }

  /**
   * Returns the quads defining the given object property.
   * @param propertyName name or node or Uri
   * @param includeCommentAndLabel whether the label and comment should be fetched as well. If false the quads are present but the value is null.
   * @returns {Promise<unknown>}
   */
  getObjectPropertyQuads(propertyName, includeCommentAndLabel = true) {
    const node = schema.toUri(this.rootId, propertyName)
    return new Promise(async (resolve, reject) => {
      const domainQuads = await this.getQuads({ subject: node, predicate: SpecialNodes.domain })
      let domains = []
      if (!_.isNil(domainQuads)) {
        domains = domainQuads.map((q) => q.object.id)
      }
      const rangeQuads = await this.getQuads({ subject: node, predicate: SpecialNodes.range })
      let ranges = []
      if (!_.isNil(rangeQuads)) {
        ranges = rangeQuads.map((q) => q.object.id)
      }
      const label = includeCommentAndLabel ? await this.getFirstLabel(node) : null
      const comment = includeCommentAndLabel ? await this.getFirstComment(node) : null
      const quads = schema.getObjectPropertyQuads(
        this.rootId,
        propertyName,
        domains,
        ranges,
        label,
        comment
      )
      resolve(quads)
    })
  }

  /**
   * Returns the quads defining the given data property.
   * @param propertyName name or node or Uri
   * @param includeCommentAndLabel whether the label and comment should be fetched as well. If false the quads are present but the value is null.
   * @returns {Promise<unknown>}
   */
  getDataPropertyQuads(propertyName, includeCommentAndLabel = true) {
    const node = schema.toUri(this.rootId, propertyName)
    return new Promise(async (resolve, reject) => {
      const domainQuads = await this.getQuads({ subject: node, predicate: SpecialNodes.domain })
      let domains = []
      if (!_.isNil(domainQuads)) {
        domains = domainQuads.map((q) => q.object.id)
      }
      const label = includeCommentAndLabel ? await this.getFirstLabel(node) : null
      const comment = includeCommentAndLabel ? await this.getFirstComment(node) : null
      const quads = schema.getDataPropertyQuads(this.rootId, propertyName, domains, label, comment)
      resolve(quads)
    })
  }

  /**
   * Fetches the quads defining the class with the given name.
   * @param className class name or Uri or node
   * @param includeCommentAndLabel whether the label and comment should be fetched as well. If false the quads are present but the value is null.
   * @returns {Promise<Array>}
   */
  getClassQuads(className, includeCommentAndLabel = true) {
    const node = schema.toUri(this.rootId, className)
    return new Promise(async (resolve, reject) => {
      let parentClassName = null
      const parentQuad = await this.getQuads({ subject: node, predicate: SpecialNodes.subClassOf })
      if (!_.isNil(parentQuad) && parentQuad.length > 0) {
        // we'll ignore multiple inheritance
        parentClassName = parentQuad[0].object
      }
      const label = includeCommentAndLabel ? await this.getFirstLabel(node) : null
      const comment = includeCommentAndLabel ? await this.getFirstComment(node) : null
      const quads = schema.getClassQuads(this.rootId, className, parentClassName, label, comment)
      resolve(quads)
    })
  }

  /**
   * Returns the data properties of the specified class.
   * @param className name, uri or node of a class
   * @returns {Promise<Array>}
   */
  getDataPropertyUrisOfClass(className) {
    let classId, classNode
    if (schema.isNamedNode(className)) {
      classNode = className
      classId = className.id
    } else {
      classNode = schema.toUri(this.rootId, className)
      classId = classNode.id
    }
    return new Promise(async (resolve, reject) => {
      const allProps = await this.getDataPropertyUris()
      const classProps = new Set()
      if (_.isNil(allProps) || allProps.length === 0) {
        return resolve(classProps)
      }
      for (let i = 0; i < allProps.length; i++) {
        const propUri = allProps[i]
        const propNode = namedNode(propUri)
        const domQuads = await this.getQuads({ subject: propNode, predicate: SpecialNodes.domain })
        if (_.isNil(domQuads)) {
          continue
        }
        domQuads.forEach((q) => {
          if (q.object.id === classId) {
            classProps.add(propUri)
          }
        })
      }
      resolve(Array.from(classProps))
    })
  }

  /**
   * Returns the object properties of the specified class.
   * @param className name, uri or node of a class
   * @returns {Promise<Array>}
   */
  getObjectPropertyUrisOfClass(className) {
    let classId, classNode
    if (schema.isNamedNode(className)) {
      classNode = className
      classId = className.id
    } else {
      classNode = schema.toUri(this.rootId, className)
      classId = classNode.id
    }
    return new Promise(async (resolve, reject) => {
      const allProps = await this.getObjectPropertyUris()
      const classProps = new Set()
      if (_.isNil(allProps) || allProps.length === 0) {
        return resolve(classProps)
      }
      for (let i = 0; i < allProps.length; i++) {
        const propUri = allProps[i]
        const propNode = namedNode(propUri)
        const domQuads = await this.getQuads({ subject: propNode, predicate: SpecialNodes.domain })
        if (_.isNil(domQuads)) {
          continue
        }
        domQuads.forEach((q) => {
          if (q.object.id === classId) {
            classProps.add(propUri)
          }
        })
      }
      resolve(Array.from(classProps))
    })
  }

  getDataPropertyUris() {
    return new Promise(async (resolve, reject) => {
      const quads = await this.getQuads({
        predicate: SpecialNodes.a,
        object: SpecialNodes.owlDatatypeProperty,
      })
      if (_.isNil(quads)) {
        resolve([])
      } else {
        resolve(quads.map((q) => q.subject.id))
      }
    })
  }

  getObjectPropertyUris() {
    return new Promise(async (resolve, reject) => {
      const quads = await this.getQuads({
        predicate: SpecialNodes.a,
        object: SpecialNodes.owlObjectProperty,
      })
      if (_.isNil(quads)) {
        resolve([])
      } else {
        resolve(quads.map((q) => q.subject.id))
      }
    })
  }

  /**
   * Adds an ontology class to the ontology.
   * @param className the name of the new class or named node (allows for non-root classes).
   * @param parentClassName optional parent class
   * @returns {PromiseLike<Array>}
   */
  async addClass(className, parentClassName = null, label = null, comment = null) {
    await this.ensureDoesNotExist(className)
    if (_.isNil(parentClassName)) {
      return this.store.put(schema.getClassQuads(this.rootId, className, null, label, comment))
    } else {
      return this.store.put(schema.getClassQuads(this.rootId, parentClassName)).then(() => {
        return this.store.put(
          schema.getClassQuads(this.rootId, className, parentClassName, label, comment)
        )
      })
    }
  }

  /**
   * Adds an ontology object property to the ontology.
   * @param propertyName name, uri or node of the new property
   * @param domain name, uri or node of the domain
   * @param range name, uri or node of the range
   * @param label optional label to set
   * @param comment optional comment
   * @returns {Promise}
   */
  async addObjectProperty(propertyName, domain, range, label = null, comment = null) {
    await this.ensureDoesNotExist(propertyName)
    propertyName = this.ensureParameter(propertyName, 'propertyName')
    domain = this.ensureParameter(domain, 'domain')
    range = this.ensureParameter(range, 'range')

    return this.store.put(
      schema.getObjectPropertyQuads(this.rootId, propertyName, domain, range, label, comment)
    )
  }

  /**
   * Adds a data property to the ontology.
   * @param propertyName name, uri or node of the new property
   * @param domain name, uri or node of the domain
   * @param label optional label to set
   * @param comment optional comment
   * @returns {Promise}
   */
  async addDatatypeProperty(propertyName, domain, label = null, comment = null) {
    propertyName = this.ensureParameter(propertyName, 'propertyName')
    domain = this.ensureParameter(domain, 'domain')
    await this.ensureDoesNotExist(propertyName)

    return this.store.put(
      schema.getDataPropertyQuads(this.rootId, propertyName, domain, label, comment)
    )
  }

  /**
   * Check the validity of the given value
   * @param s a value
   * @param name the name of the corresponding parameter
   * @returns {*}
   */
  ensureParameter(s, name) {
    if (_.isNil(s)) {
      throw new Error(`Got nil parameter '${name}'.`)
    }
    if (!_.isString(s) && !isNamedNode(s)) {
      throw new Error(`Expected parameter '${name}' to be a string or a node.`)
    }
    if (isNamedNode(s)) {
      return s.id
    }
    return s
  }

  /**
   * Returns whether the given class name exists in the current ontology.
   * @param className name, node or Uri
   * @returns {Promise<boolean>}
   */
  classExists(className) {
    const schema = require('../knwl/ontology').Schema
    return new Promise((resolve, reject) => {
      const node = schema.toUri(this.rootId, className)
      const found = []
      this.store
        .match(node, SpecialNodes.a, SpecialNodes.owlClass)
        .on('error', (err) => {
          reject(err)
        })
        .on('data', (quad) => {
          found.push(quad)
        })
        .on('end', (q) => {
          resolve(found.length > 0)
        })
    })
  }

  objectPropertyExists(propertyName) {
    const schema = require('../knwl/ontology').Schema
    return new Promise((resolve, reject) => {
      const node = schema.toUri(this.rootId, propertyName)
      const found = []
      this.store
        .match(node, SpecialNodes.a, SpecialNodes.owlObjectProperty)
        .on('error', (err) => {
          reject(err)
        })
        .on('data', (quad) => {
          found.push(quad)
        })
        .on('end', (q) => {
          resolve(found.length > 0)
        })
    })
  }

  dataPropertyExists(propertyName) {
    const schema = require('../knwl/ontology').Schema
    return new Promise((resolve, reject) => {
      const node = schema.toUri(this.rootId, propertyName)
      const found = []
      this.store
        .match(node, SpecialNodes.a, SpecialNodes.owlDatatypeProperty)
        .on('error', (err) => {
          reject(err)
        })
        .on('data', (quad) => {
          found.push(quad)
        })
        .on('end', (q) => {
          resolve(found.length > 0)
        })
    })
  }

  async ensureDoesNotExist(uri) {
    uri = schema.toUri(this.rootId, uri)
    const found = await this.getOntologyType(uri)
    if (!_.isNil(found)) {
      throw new Error(`An ontology object with Uri '${uri}' already exists with type '${found}'.`)
    }
  }

  getOntologyType(uri) {
    if (_.isNil(uri)) {
      throw new Error('Missing Uri parameter.')
    }
    if (_.isString(uri)) {
      if (!uri.startsWith('http')) {
        throw new Error('The Uri parameter should be a http address.')
      }
      uri = namedNode(uri)
    } else if (!isNamedNode(uri)) {
      throw new Error('Uri parameter should be an http address or node.')
    }
    return new Promise((resolve, reject) => {
      const found = []
      this.store
        .match(uri, SpecialNodes.a, null)
        .on('error', (err) => {
          reject(err)
        })
        .on('data', (quad) => {
          found.push(quad)
        })
        .on('end', (q) => {
          switch (found.length) {
            case 0:
              resolve(null)
              break
            case 1:
              resolve(schema.toShortForm(this.rootId, found[0].object.id))
              break
            default:
              // this one is problematic, having multiple inheritance makes things complicated
              resolve('Other')
          }
        })
    })
  }

  /**
   * Returns a graph (in json format) containing the Uris of the classes and the object properties.
   * Data properties, labels and comments are not included.
   */
  async getSimplifiedOntologyGraph(onlyOwn = true, onlyConnected = true) {
    if (onlyConnected) {
      const links = await this.getSimplifiedObjectProperties(onlyOwn)
      const nodes = new Set()
      links.forEach((l) => {
        nodes.add(l.from)
        nodes.add(l.to)
      })
      return {
        nodes: Array.from(nodes),
        links: links,
      }
    } else {
      const nodes = await this.getClassUris(onlyOwn)
      const links = await this.getSimplifiedObjectProperties(onlyOwn)
      return {
        nodes: nodes,
        links: links,
      }
    }
  }
}

module.exports = OntologyStore
