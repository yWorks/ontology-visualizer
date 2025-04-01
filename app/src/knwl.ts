/**
 * Proxy to the backend.
 */
export class Knwl {
  private readonly url: string

  constructor(url: string) {
    if (!url) {
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
  async getClass(className: string, includeProps = false) {
    const response = await fetch(`${this.url}getClass`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ className: className, includeProps: includeProps }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  }

  /**
   * Returns the connected ontology as a node+links graph structure.
   */
  async getSimplifiedOntologyGraph() {
    const response = await fetch(`${this.url}getSimplifiedOntologyGraph`, {
      method: 'GET',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  }
}
