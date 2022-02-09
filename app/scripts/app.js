import 'bootstrap'
import 'bootstrap/dist/css/bootstrap.min.css'
import '@fortawesome/fontawesome-free/js/fontawesome'
import '@fortawesome/fontawesome-free/js/solid'
import '@fortawesome/fontawesome-free/js/regular'
import '@fortawesome/fontawesome-free/js/brands'
import 'lodash'
import Knwl from './knwl'
import HTMLPopupSupport from './popup'

import {
  CircularLayout,
  Class,
  Cursor,
  DefaultLabelStyle,
  EdgePathLabelModel,
  ExteriorLabelModel,
  ExteriorLabelModelPosition,
  Font,
  FreeNodeLabelModel,
  GeneralPath,
  GraphBuilder,
  GraphComponent,
  GraphItemTypes,
  GraphOverviewCanvasVisualCreator,
  GraphOverviewComponent,
  GraphViewerInputMode,
  HierarchicLayout,
  IEdge,
  ImageNodeStyle,
  INode,
  Insets,
  Key,
  LayoutExecutor,
  LayoutStageBase,
  License,
  OrganicLayout,
  Point,
  PolylineEdgeStyle,
  Rect,
  Size,
  Stroke,
  TemplateNodeStyle,
  TextRenderSupport,
  TextWrapping,
  YPoint,
} from 'yfiles'
import lic from '../yfiles/license.json'
import { LODLabelStyleRenderer } from './lodlabelstyle'

// Tell the library about the license contents
License.value = lic

// We need to load the yfiles/view-layout-bridge module explicitly to prevent the webpack
// tree shaker from removing this dependency which is needed for 'morphLayout' in this app.
Class.ensure(LayoutExecutor)

// We need to load the 'styles-other' module explicitly to prevent tree-shaking
// tools it from removing this dependency which is needed for loading all library styles.
Class.ensure(ImageNodeStyle)

const defaultFontFamily =
  '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"'

class GraphOverviewVisualCreator extends GraphOverviewCanvasVisualCreator {
  /**
   * Paints the path of the edge in a very light gray.
   * @param {IRenderContext} renderContext
   * @param {CanvasRenderingContext2D} ctx
   * @param {IEdge} edge
   */
  paintEdge(renderContext, ctx, edge) {
    ctx.strokeStyle = '#f7f7f7'
    ctx.beginPath()
    ctx.moveTo(edge.sourcePort.location.x, edge.sourcePort.location.y)
    edge.bends.forEach((bend) => {
      ctx.lineTo(bend.location.x, bend.location.y)
    })
    ctx.lineTo(edge.targetPort.location.x, edge.targetPort.location.y)
    ctx.stroke()
  }

  /**
   * Paints the outline of the group node in a very light gray.
   * @param {IRenderContext} renderContext
   * @param {CanvasRenderingContext2D} ctx
   * @param {INode} node
   */
  paintGroupNode(renderContext, ctx, node) {
    ctx.strokeStyle = '#f7f7f7'
    ctx.strokeRect(node.layout.x, node.layout.y, node.layout.width, node.layout.height)
  }

  /**
   * Paints the rectangle of the node in a very light gray
   * @param {IRenderContext} renderContext
   * @param {CanvasRenderingContext2D} ctx
   * @param {INode} node
   */
  paintNode(renderContext, ctx, node) {
    ctx.fillStyle = '#f7f7f7'
    ctx.fillRect(node.layout.x, node.layout.y, node.layout.width, node.layout.height)
  }
}

class App {
  initialize() {
    this.knwl = new Knwl('http://localhost:3001/api/')

    // create a GraphComponent
    this.graphComponent = new GraphComponent('#graph')

    this.graphComponent.graph.nodeDefaults.size = new Size(50, 50)
    const templateNodeStyle = new TemplateNodeStyle('classTemplate')
    const outline = new GeneralPath()
    outline.appendEllipse(new Rect(0, 0, 1, 1), false)
    templateNodeStyle.normalizedOutline = outline
    this.graphComponent.graph.nodeDefaults.style = templateNodeStyle
    this.graphComponent.graph.edgeDefaults.style = new PolylineEdgeStyle({
      stroke: Stroke.WHITE_SMOKE,
      targetArrow: 'white medium triangle',
      smoothingLength: 10,
    })

    this.graphComponent.graph.nodeDefaults.labels.style = new DefaultLabelStyle({
      renderer: new LODLabelStyleRenderer(0.75),
      backgroundFill: 'rgba(255,255,255,0.9)',
      textFill: '#636363',
      font: `12px ${defaultFontFamily}`,
      insets: new Insets(4),
    })
    this.graphComponent.graph.nodeDefaults.labels.layoutParameter =
      FreeNodeLabelModel.INSTANCE.createParameter(
        new Point(0.5, 1),
        new Point(0, 0),
        new Point(0.5, 0.5)
      )

    this.initializeInputMode()
    this.initializePopups()
    this.initializeInteractions()
    this.knwl.getSimplifiedOntologyGraph().then(async (data) => {
      await this.assembleGraph(data)
    })

    this.overviewComponent = new GraphOverviewComponent('overviewComponent', this.graphComponent)
    this.overviewComponent.graphVisualCreator = new GraphOverviewVisualCreator(
      this.overviewComponent.graph
    )
  }

  initializePopups() {
    // Creates a label model parameter that is used to position the node pop-up
    const nodeLabelModel = new ExteriorLabelModel({ insets: 10 })

    // Creates the pop-up for the node pop-up template
    this.nodePopup = new HTMLPopupSupport(
      this.graphComponent,
      window.document.getElementById('nodePopupContent'),
      nodeLabelModel.createParameter(ExteriorLabelModelPosition.NORTH)
    )

    // Creates the edge pop-up for the edge pop-up template with a suitable label model parameter
    // We use the EdgePathLabelModel for the edge pop-up
    const edgeLabelModel = new EdgePathLabelModel({ autoRotation: false })

    // Creates the pop-up for the edge pop-up template
    const edgePopup = new HTMLPopupSupport(
      this.graphComponent,
      window.document.getElementById('edgePopupContent'),
      edgeLabelModel.createDefaultParameter()
    )

    // The following works with both GraphEditorInputMode and GraphViewerInputMode
    const inputMode = this.graphComponent.inputMode

    // The pop-up is shown for the currentItem thus nodes and edges should be focusable
    inputMode.focusableItems = GraphItemTypes.NODE | GraphItemTypes.EDGE

    // Register a listener that shows the pop-up for the currentItem
    this.graphComponent.selection.addItemSelectionChangedListener((sender, args) => {
      if (!args.itemSelected) {
        this.nodePopup.currentItem = null
        edgePopup.currentItem = null
        return
      }
      const item = args.item
      if (INode.isInstance(item)) {
        // update data in node pop-up
        this.updateNodePopupContent(this.nodePopup, item)
        // open node pop-up and hide edge pop-up
        this.nodePopup.currentItem = item
        edgePopup.currentItem = null
      } else if (IEdge.isInstance(item)) {
        // update data in edge pop-up
        this.updateEdgePopupContent(edgePopup, item)
        // open edge pop-up and node edge pop-up
        edgePopup.currentItem = item
        this.nodePopup.currentItem = null
      } else {
        this.nodePopup.currentItem = null
        edgePopup.currentItem = null
      }
    })

    // On clicks on empty space, hide the popups
    inputMode.addCanvasClickedListener((sender, args) => {
      this.nodePopup.currentItem = null
      edgePopup.currentItem = null
    })

    // On press of the ESCAPE key, set currentItem to <code>null</code> to hide the pop-ups
    inputMode.keyboardInputMode.addKeyBinding({
      key: Key.ESCAPE,
      execute: (command, parameter, source) => {
        source.currentItem = null
      },
    })
  }

  updateNodePopupContent(nodePopup, /*INode*/ node) {
    // get business data from node tag
    const id = node.tag
    this.knwl.getClass(id).then((data) => {
      // get all divs in the pop-up
      const divs = nodePopup.div.getElementsByTagName('div')
      for (let i = 0; i < divs.length; i++) {
        const div = divs.item(i)
        if (div.hasAttribute('data-id')) {
          // if div has a 'data-id' attribute, get content from the business data
          const id = div.getAttribute('data-id')
          if (id === 'id') {
            //make a <a> rather than text
            const short = this.toShortForm(data[id])
            div.children[1].href = `http://dbpedia.org/ontology/${short}`
            div.children[1].textContent = `dbpedia:${short}`
          } else {
            div.children[1].textContent = data[id]
          }
        }
      }
    })
  }

  updateEdgePopupContent(edgePopup, edge) {
    // get business data from node tags
    const edgeData = edge.tag
    const sourceData = edge.sourcePort.owner.tag
    const targetData = edge.targetPort.owner.tag

    const font = new Font(defaultFontFamily, 12)
    const size = new Size(100, 20)
    const wrapping = TextWrapping.CHARACTER_ELLIPSIS

    const sourceText = edgePopup.div.querySelector('*[data-id="sourceName"]')
    TextRenderSupport.addText(sourceText, this.toShortForm(sourceData), font, size, wrapping)

    const linkText = edgePopup.div.querySelector('*[data-id="linkName"]')
    const linkSize = new Size(170, 20)
    const linkFont = new Font(defaultFontFamily, 12, 'normal', 'bold')
    const linkShort = this.toShortForm(edgeData.uri)
    TextRenderSupport.addText(linkText, linkShort, linkFont, linkSize, wrapping)
    const linkAnchor = linkText.parentElement
    linkAnchor.setAttribute('href', `http://dbpedia.org/ontology/${linkShort}`)

    const targetText = edgePopup.div.querySelector('*[data-id="targetName"]')
    TextRenderSupport.addText(targetText, this.toShortForm(targetData), font, size, wrapping)
  }

  /**
   * Shortens the Uri to something one can display.
   * @param uri
   * @returns {string|*}
   */
  toShortForm(uri) {
    if (_.isString(uri)) {
      uri = uri
        .replace('http://dbpedia.org/ontology', '')
        .replace('http://www.w3.org/1999/02/22-rdf-syntax-ns#', '')
        .replace('http://www.w3.org/2000/01/rdf-schema#', '')
        .replace('http://www.w3.org/2002/07/owl#', '')
      if (uri.indexOf('/') > -1) {
        uri = uri.slice(uri.indexOf('/') + 1)
      }
      if (uri.indexOf('#') > -1) {
        uri = uri.slice(uri.lastIndexOf('#') + 1)
      }
      return uri
    } else if (_.isArray(uri)) {
      uri.map((u) => this.toShortForm(u))
    } else {
      return uri.toString()
    }
  }

  async assembleGraph(data) {
    const builder = new GraphBuilder(this.graphComponent.graph)
    builder.createNodesSource({ data: data.nodes, id: null })
    builder.createEdgesSource({ data: data.links, sourceId: 'from', targetId: 'to' })
    builder.addNodeCreatedListener((sender, args) => {
      sender.graph.addLabel(args.item, this.toShortForm(args.item.tag))
    })
    this.graphComponent.graph = builder.buildGraph()

    this.layoutHierarchic()
    this.graphComponent.fitContent()
  }

  constructor() {
    this.initialize()
  }

  initializeInputMode() {
    const mode = new GraphViewerInputMode({
      toolTipItems: GraphItemTypes.NODE,
      selectableItems: GraphItemTypes.NODE | GraphItemTypes.EDGE,
      marqueeSelectableItems: GraphItemTypes.NONE,
    })

    mode.mouseHoverInputMode.toolTipLocationOffset = new Point(10, 10)
    mode.addQueryItemToolTipListener((sender, args) => {
      if (INode.isInstance(args.item) && !args.handled) {
        const nodeName = args.item.tag
        if (nodeName != null) {
          args.toolTip = nodeName
          args.handled = true
        }
      }
    })
    mode.itemHoverInputMode.hoverCursor = Cursor.POINTER
    mode.itemHoverInputMode.hoverItems = GraphItemTypes.NODE | GraphItemTypes.EDGE
    mode.itemHoverInputMode.discardInvalidItems = false
    mode.itemHoverInputMode.addHoveredItemChangedListener((sender, args) => {
      const item = args.item
      const highlightIndicatorManager = this.graphComponent.highlightIndicatorManager
      highlightIndicatorManager.clearHighlights()
      if (item) {
        highlightIndicatorManager.addHighlight(item)
        if (INode.isInstance(item)) {
          this.graphComponent.graph.edgesAt(item).forEach((edge) => {
            highlightIndicatorManager.addHighlight(edge)
          })
        } else if (IEdge.isInstance(item)) {
          highlightIndicatorManager.addHighlight(item.sourceNode)
          highlightIndicatorManager.addHighlight(item.targetNode)
        }
      }
    })
    this.graphComponent.inputMode = mode
  }

  layoutCircular() {
    return this.runLayout(
      new CircularLayout({
        partitionStyle: 'disk',
      })
    )
  }

  layoutOrganic() {
    return this.runLayout(
      new OrganicLayout({
        preferredEdgeLength: 200,
      })
    )
  }

  layoutHierarchic() {
    return this.runLayout(
      new HierarchicLayout({
        considerNodeLabels: true,
      })
    )
  }

  runLayout(layout) {
    return this.graphComponent.morphLayout(new CenterPortsLayoutStage(layout))
  }

  zoomToLocation(item) {
    const location = this.getFocusPoint(item)

    this.graphComponent.zoomToAnimated(location, 1.5)
    // display the popup info as well
    this.updateNodePopupContent(this.nodePopup, item)
    this.nodePopup.currentItem = item
  }

  /**
   * Returns the point corresponding to the given INode.
   * @param item a node
   * @returns {Point}
   */
  getFocusPoint(item) {
    if (IEdge.isInstance(item)) {
      // If the source and the target node are in the view port, then zoom to the middle point of the edge
      const targetNodeCenter = item.targetNode.layout.center
      const sourceNodeCenter = item.sourceNode.layout.center
      const viewport = this.graphComponent.viewport
      if (viewport.contains(targetNodeCenter) && viewport.contains(sourceNodeCenter)) {
        return new Point(
          (sourceNodeCenter.x + targetNodeCenter.x) / 2,
          (sourceNodeCenter.y + targetNodeCenter.y) / 2
        )
      } else {
        if (
          viewport.center.subtract(targetNodeCenter).vectorLength <
          viewport.center.subtract(sourceNodeCenter).vectorLength
        ) {
          // If the source node is out of the view port, then zoom to it
          return sourceNodeCenter
        } else {
          // Else zoom to the target node
          return targetNodeCenter
        }
      }
    } else if (INode.isInstance(item)) {
      return item.layout.center
    }
  }

  /**
   * Defines the various interactions in the app.
   * It ain't Angular or React, the simplicity of jQuery is sometimes still pleasing.
   */
  initializeInteractions() {
    $('#navFit').click(() => {
      this.graphComponent.fitContent()
    })
    $('#navOverview').click(() => {
      if ($('.overview-container').is(':hidden')) {
        $('.overview-container').show('slow')
      } else {
        $('.overview-container').hide('slow')
      }
    })
    $('#navCircular').click(() => {
      this.layoutCircular()
    })
    $('#navOrganic').click(() => {
      this.layoutOrganic()
    })
    $('#navHierarchic').click(() => {
      this.layoutHierarchic()
    })
    $('#search-stuff').keypress((e) => {
      if (e.which === 13) {
        const term = $('#search-stuff').val()
        $('#search-stuff').val('')
        const ns = this.graphComponent.graph.nodes
        for (let i = 0; i < ns.size; i++) {
          const n = ns.get(i)
          if (n.tag.toLowerCase().indexOf(term) > -1) {
            this.zoomToLocation(n)
            return
          }
        }
      }
    })
    $('#openPanel').click(() => {
      const item = this.nodePopup.currentItem
      if (!_.isNil(item)) {
        this.showClassDetails(item)
      }
    })
  }

  /**
   * Display the sliding panel with all the details of the selected ontology class.
   * @param item
   * @returns {Promise<void>}
   */
  async showClassDetails(/*INode*/ item) {
    if (_.isNil(item)) {
      return
    }
    const uri = item.tag
    const cls = await this.knwl.getClass(uri, true)
    if (!_.isNil(cls)) {
      const objList = $('#objProp-list')
      objList.empty()
      $('#detailsPanel-title').html(this.toShortForm(uri))
      if (cls.objectProperties.length > 0) {
        cls.objectProperties.forEach((p) => {
          objList.append(
            `<div class="col-md-5 offset-col-md-2 text-truncate"><a class="prop-link" href="${p.uri}" target="_blank">${p.name}</a></div>`
          )
        })
      } else {
        objList.append(
          '<p style="margin:20px; font-size:smaller"   >This class does not have any object properties defined.</p>'
        )
      }
      const dataList = $('#dataProp-list')
      dataList.empty()
      if (cls.dataProperties.length > 0) {
        cls.dataProperties.forEach((p) => {
          dataList.append(
            `<div class="col-md-5 offset-col-md-2 text-truncate"><a class="prop-link" href="${p.uri}" target="_blank">${p.name}</a></div>`
          )
        })
      } else {
        dataList.append(
          '<p style="margin:20px; font-size:smaller">This class does not have any data properties defined.</p>'
        )
      }

      // open the panel
      $('#detailsPanel').modal()
    }
  }
}

new App()

class CenterPortsLayoutStage extends LayoutStageBase {
  applyLayout(graph) {
    this.applyLayoutCore(graph)

    graph.edges.forEach((edge) => {
      graph.getLayout(edge).sourcePoint = YPoint.ORIGIN
      graph.getLayout(edge).targetPoint = YPoint.ORIGIN
    })
  }
}
