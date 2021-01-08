const knwl = require('./knwl')
const path = require('path')
const Knowledge = knwl.Knowledge
const knowledge = new Knowledge('http://dbpedia.org/ontology/')
knowledge.clear().then(() => {
  knowledge.loadData(path.join(__dirname, './data/DbPedia.ttl')).then(() => {
    knowledge.countTriples().then((count) => {
      console.log('DbPedia ontology loaded.')
      console.log(`There are now ${count} triples in the store.`)
    })
  })
})
