import * as path from 'node:path'
import { dirname } from 'node:path'
import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Schema, SpecialNodes } from './ontology.js'
import { Quadstore } from 'quadstore'
import { ClassicLevel } from 'classic-level'
import { DataFactory, StreamParser, Util } from 'n3'

const { namedNode } = DataFactory
const { isNamedNode } = Util

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Simplified API to manage the quadstore ontology.
 */
export class OntologyStore {
  constructor(rootId) {
    this.rootId = Schema.ensureRootId(rootId)
    const dbPath = path.join(__dirname, '../database')
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath)
    }
    this.store = new Quadstore({ backend: new ClassicLevel(dbPath), dataFactory: DataFactory })
  }

  /**
   * Imports the data in the triple store.
   * @param dataPath path to an RDF, turtle or other triple format.
   * @returns {*|Promise|Promise<unknown>|undefined}
   */
  async loadFileData(dataPath) {
    if (!dataPath) {
      throw new Error('Missing path to data file.')
    }
    if (!fs.existsSync(dataPath)) {
      throw new Error(`File '${dataPath}' does not exist.`)
    }
    await this.store.open()
    const streamParser = new StreamParser({ format: 'text/turtle' })
    const inputStream = fs.createReadStream(dataPath)
    try {
      return this.store.putStream(inputStream.pipe(streamParser), { batchSize: 100 }).then(() => {
        this.store.close()
      })
    } catch (e) {
      console.error(e)
      return Promise.resolve()
    }
  }

  /**
   * Returns the triple count.
   */
  async countTriples() {
    // expensive wayt to do it but it's the only one
    const found = await this.getQuads({})
    return !found ? 0 : found.length
  }

  /**
   * Clears the whole store.
   */
  async clear() {
    await this.store.open()
    return new Promise((resolve, reject) => {
      this.store
        .removeMatches(null, null, null)
        .on('error', (err) => {
          reject(err)
        })
        .on('end', () => {
          console.log('The store has been emptied.')
          resolve()
        })
    }).then(() => {
      void this.store.close()
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
    //                             ?uri a <${Schema.objectProperty}>;
    //                             <${Schema.domain}> ?d.
    //                              OPTIONAL { ?uri <${Schema.range}> ?ra }
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
      if (!domain || (onlyOwn && !uri.startsWith(this.rootId))) {
        continue
      }
      if (!uris[uri]) {
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
      if (!range || (onlyOwn && !uri.startsWith(this.rootId))) {
        continue
      }
      if (!uris[uri]) {
        uris[uri] = { froms: new Set(), tos: new Set() }
      }
      uris[uri].tos.add(range)
    }

    // disentangle the arrays
    const result = []
    Object.keys(uris).forEach((k) => {
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
    await this.store.open()
    const { items } = await this.store.get(pattern)
    await this.store.close()
    if (!items || items.length === 0) {
      return []
    }
    return items
  }

  /**
   * Returns the first label of the specified Uri.
   * @param uri Uri of a node
   * @returns {Promise<string>}
   */
  async getFirstLabel(uri) {
    if (!isNamedNode(uri)) {
      uri = Schema.toUri(this.rootId, uri)
    }
    const found = await this.getQuads({ subject: uri, predicate: SpecialNodes.label })
    if (!found || found.length === 0) {
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
    if (!isNamedNode(uri)) {
      uri = Schema.toUri(this.rootId, uri)
    }
    const found = await this.getQuads({ subject: uri, predicate: SpecialNodes.comment })
    if (!found || found.length === 0) {
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
    const node = Schema.toUri(this.rootId, propertyName)
    return new Promise(async (resolve, reject) => {
      const domainQuads = await this.getQuads({ subject: node, predicate: SpecialNodes.domain })
      let domains = []
      if (domainQuads) {
        domains = domainQuads.map((q) => q.object.id)
      }
      const rangeQuads = await this.getQuads({ subject: node, predicate: SpecialNodes.range })
      let ranges = []
      if (rangeQuads) {
        ranges = rangeQuads.map((q) => q.object.id)
      }
      const label = includeCommentAndLabel ? await this.getFirstLabel(node) : null
      const comment = includeCommentAndLabel ? await this.getFirstComment(node) : null
      const quads = Schema.getObjectPropertyQuads(
        this.rootId,
        propertyName,
        domains,
        ranges,
        label,
        comment,
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
    const node = Schema.toUri(this.rootId, propertyName)
    return new Promise(async (resolve, reject) => {
      const domainQuads = await this.getQuads({ subject: node, predicate: SpecialNodes.domain })
      let domains = []
      if (domainQuads) {
        domains = domainQuads.map((q) => q.object.id)
      }
      const label = includeCommentAndLabel ? await this.getFirstLabel(node) : null
      const comment = includeCommentAndLabel ? await this.getFirstComment(node) : null
      const quads = Schema.getDataPropertyQuads(this.rootId, propertyName, domains, label, comment)
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
    const node = Schema.toUri(this.rootId, className)
    return new Promise(async (resolve, reject) => {
      let parentClassName = null
      const parentQuad = await this.getQuads({ subject: node, predicate: SpecialNodes.subClassOf })
      if (parentQuad && parentQuad.length > 0) {
        // we'll ignore multiple inheritance
        parentClassName = parentQuad[0].object
      }
      const label = includeCommentAndLabel ? await this.getFirstLabel(node) : null
      const comment = includeCommentAndLabel ? await this.getFirstComment(node) : null
      const quads = Schema.getClassQuads(this.rootId, className, parentClassName, label, comment)
      resolve(quads)
    })
  }

  /**
   * Returns the data properties of the specified class.
   * @param className name, uri or node of a class
   * @returns {Promise<Array>}
   */
  getDataPropertyUrisOfClass(className) {
    let classId
    if (isNamedNode(className)) {
      classId = className.id
    } else {
      const classNode = Schema.toUri(this.rootId, className)
      classId = classNode.id
    }
    return new Promise(async (resolve, reject) => {
      const allProps = await this.getDataPropertyUris()
      const classProps = new Set()
      if (!allProps || allProps.length === 0) {
        return resolve(classProps)
      }
      for (let i = 0; i < allProps.length; i++) {
        const propUri = allProps[i]
        const propNode = namedNode(propUri)
        const domQuads = await this.getQuads({ subject: propNode, predicate: SpecialNodes.domain })
        if (!domQuads) {
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
    let classId
    if (isNamedNode(className)) {
      classId = className.id
    } else {
      const classNode = Schema.toUri(this.rootId, className)
      classId = classNode.id
    }
    return new Promise(async (resolve, reject) => {
      const allProps = await this.getObjectPropertyUris()
      const classProps = new Set()
      if (!allProps || allProps.length === 0) {
        return resolve(classProps)
      }
      for (let i = 0; i < allProps.length; i++) {
        const propUri = allProps[i]
        const propNode = namedNode(propUri)
        const domQuads = await this.getQuads({ subject: propNode, predicate: SpecialNodes.domain })
        if (!domQuads) {
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
      if (!quads) {
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
      if (!quads) {
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
   * @returns {Promise<void>}
   */
  async addClass(className, parentClassName = null, label = null, comment = null) {
    await this.store.open()
    await this.ensureDoesNotExist(className)
    if (!parentClassName) {
      const classQuads = Schema.getClassQuads(this.rootId, className, null, label, comment)
      return this.store.multiPut(classQuads)
    } else {
      return this.store
        .multiPut(Schema.getClassQuads(this.rootId, parentClassName))
        .then(() => {
          return this.store.multiPut(
            Schema.getClassQuads(this.rootId, className, parentClassName, label, comment),
          )
        })
        .then(() => this.store.close())
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
    await this.store.open()
    await this.ensureDoesNotExist(propertyName)
    propertyName = this.ensureParameter(propertyName, 'propertyName')
    domain = this.ensureParameter(domain, 'domain')
    range = this.ensureParameter(range, 'range')

    return this.store
      .multiPut(
        Schema.getObjectPropertyQuads(this.rootId, propertyName, domain, range, label, comment),
      )
      .then(() => this.store.close())
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
    await this.store.open()
    propertyName = this.ensureParameter(propertyName, 'propertyName')
    domain = this.ensureParameter(domain, 'domain')
    await this.ensureDoesNotExist(propertyName)

    return this.store
      .multiPut(Schema.getDataPropertyQuads(this.rootId, propertyName, domain, label, comment))
      .then(() => this.store.close())
  }

  /**
   * Check the validity of the given value
   * @param s a value
   * @param name the name of the corresponding parameter
   * @returns {*}
   */
  ensureParameter(s, name) {
    if (!s) {
      throw new Error(`Got nil parameter '${name}'.`)
    }
    if (typeof s !== 'string' && !isNamedNode(s)) {
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
    return new Promise((resolve, reject) => {
      const node = Schema.toUri(this.rootId, className)
      const found = []
      this.store
        .match(node, SpecialNodes.a, SpecialNodes.owlClass)
        .on('error', (err) => {
          reject(err)
        })
        .on('data', (quad) => {
          found.push(quad)
        })
        .on('end', () => {
          resolve(found.length > 0)
        })
    })
  }

  async objectPropertyExists(propertyName) {
    await this.store.open()
    return new Promise((resolve, reject) => {
      const node = Schema.toUri(this.rootId, propertyName)
      const found = []
      this.store
        .match(node, SpecialNodes.a, SpecialNodes.owlObjectProperty)
        .on('error', (err) => {
          reject(err)
        })
        .on('data', (quad) => {
          found.push(quad)
        })
        .on('end', () => {
          resolve(found.length > 0)
        })
    }).then((exists) => {
      this.store.close()
      return exists
    })
  }

  async dataPropertyExists(propertyName) {
    await this.store.open()
    return new Promise((resolve, reject) => {
      const node = Schema.toUri(this.rootId, propertyName)
      const found = []
      this.store
        .match(node, SpecialNodes.a, SpecialNodes.owlDatatypeProperty)
        .on('error', (err) => {
          reject(err)
        })
        .on('data', (quad) => {
          found.push(quad)
        })
        .on('end', () => {
          resolve(found.length > 0)
        })
    }).then((exists) => {
      this.store.close()
      return exists
    })
  }

  async ensureDoesNotExist(uri) {
    uri = Schema.toUri(this.rootId, uri)
    const found = await this.getOntologyType(uri)
    if (found) {
      throw new Error(`An ontology object with Uri '${uri}' already exists with type '${found}'.`)
    }
  }

  getOntologyType(uri) {
    if (!uri) {
      throw new Error('Missing Uri parameter.')
    }
    if (typeof uri === 'string') {
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
        .on('end', () => {
          switch (found.length) {
            case 0:
              resolve(null)
              break
            case 1:
              resolve(Schema.toShortForm(this.rootId, found[0].object.id))
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
