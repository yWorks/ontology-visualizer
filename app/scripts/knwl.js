/**
 * Proxy to the backend.
 */
export default class Knwl {
  constructor(url) {
    if (_.isNil(url)) {
      throw new Error('Missing url in Knwl ctor.')
    }
    if (!url.endsWith('/')) {
      url += '/'
    }
    this.url = url
  }

  /**
   * Gets the ontology class with the specified name or uri.
   * @param className name or uri
   * @param includeProps
   */
  getClass(className, includeProps = false) {
    return $.ajax({
      url: `${this.url}getClass`,
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ name: className, includeProps: includeProps })
    })
  }

  /**
   * Returns the connected ontology as a node+links graph structure.
   */
  getSimplifiedOntologyGraph() {
    return $.ajax({
      url: `${this.url}getSimplifiedOntologyGraph`,
      method: 'GET'
    })
  }
}
