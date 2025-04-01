import * as path from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Knowledge } from 'ontology-database'

const __dirname = dirname(fileURLToPath(import.meta.url))
const knowledge = new Knowledge('http://dbpedia.org/ontology/')

knowledge.clear().then(() => {
  knowledge.loadData(path.join(__dirname, './DbPedia.ttl')).then(() => {
    knowledge.countTriples().then((count) => {
      console.log('DbPedia ontology loaded.')
      console.log(`There are now ${count} triples in the store.`)
    })
  })
})
