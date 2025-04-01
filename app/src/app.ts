import { Knwl } from './knwl'
import HTMLPopupSupport from './popup.ts'

import {
  CircularLayout,
  Cursor,
  EdgePathLabelModel,
  ExteriorNodeLabelModel,
  ExteriorNodeLabelModelPosition,
  Font,
  FreeNodeLabelModel,
  GraphBuilder,
  GraphComponent,
  GraphInputMode,
  GraphItemTypes,
  GraphOverviewComponent,
  GraphOverviewRenderer,
  GraphViewerInputMode,
  HierarchicalLayout,
  IEdge,
  ILayoutAlgorithm,
  IModelItem,
  INode,
  Insets,
  IRenderContext,
  ItemEventArgs,
  LabelStyle,
  LayoutExecutor,
  License,
  ModifierKeys,
  OrganicLayout,
  Point,
  PolylineEdgeStyle,
  ShapeNodeStyle,
  Size,
  Stroke,
  TextRenderSupport,
  TextWrapping,
} from '@yfiles/yfiles'
import license from '../license.json'
import { LODLabelStyleDecorator } from './lodlabelstyle.ts'

// Tell the library about the license contents
License.value = license

// We need to load the yfiles/view-layout-bridge module explicitly to prevent the webpack
// tree shaker from removing this dependency which is needed for 'morphLayout' in this app.
LayoutExecutor.ensure()

const defaultFontFamily =
  '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"'

class GraphOverviewCanvasRenderer extends GraphOverviewRenderer {
  /**
   * Paints the path of the edge in a very light gray.
   */
  paintEdge(_: IRenderContext, ctx: CanvasRenderingContext2D, edge: IEdge) {
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
   */
  paintGroupNode(_: IRenderContext, ctx: CanvasRenderingContext2D, node: INode) {
    ctx.strokeStyle = '#f7f7f7'
    ctx.strokeRect(node.layout.x, node.layout.y, node.layout.width, node.layout.height)
  }

  /**
   * Paints the rectangle of the node in a very light gray
   */
  paintNode(_: IRenderContext, ctx: CanvasRenderingContext2D, node: INode) {
    ctx.fillStyle = '#f7f7f7'
    ctx.fillRect(node.layout.x, node.layout.y, node.layout.width, node.layout.height)
  }
}

class App {
  private knwl: any
  private graphComponent: GraphComponent = null!
  private overviewComponent: GraphOverviewComponent = null!
  private nodePopup: HTMLPopupSupport = null!

  initialize() {
    this.knwl = new Knwl('http://localhost:3001/api/')

    // create a GraphComponent
    this.graphComponent = new GraphComponent('#graph')

    this.graphComponent.graph.nodeDefaults.size = new Size(50, 50)
    this.graphComponent.graph.nodeDefaults.style = new ShapeNodeStyle({
      shape: 'ellipse',
      stroke: '2px orange',
      fill: 'white',
    })
    this.graphComponent.graph.edgeDefaults.style = new PolylineEdgeStyle({
      stroke: Stroke.WHITE_SMOKE,
      targetArrow: 'white medium triangle',
      smoothingLength: 10,
    })

    this.graphComponent.graph.nodeDefaults.labels.style = new LODLabelStyleDecorator(
      new LabelStyle({
        shape: 'round-rectangle',
        backgroundFill: 'rgba(255,255,255,0.9)',
        textFill: '#636363',
        font: `12px ${defaultFontFamily}`,
        padding: new Insets(1, 5, 2, 5),
      }),
      0.75,
    )
    this.graphComponent.graph.nodeDefaults.labels.layoutParameter =
      FreeNodeLabelModel.INSTANCE.createParameter(
        new Point(0.5, 1),
        new Point(0, 0),
        new Point(0.5, 0.5),
      )

    this.initializeInputMode()
    this.initializePopups()
    this.initializeInteractions()
    this.knwl.getSimplifiedOntologyGraph().then(async (data: { nodes: any; links: any }) => {
      await this.assembleGraph(data)
    })

    this.overviewComponent = new GraphOverviewComponent('overviewComponent', this.graphComponent)
    this.overviewComponent.graphOverviewRenderer = new GraphOverviewCanvasRenderer()
  }

  initializePopups() {
    // Creates a label model parameter that is used to position the node pop-up
    const nodeLabelModel = new ExteriorNodeLabelModel({ margins: 10 })

    // Creates the pop-up for the node pop-up template
    this.nodePopup = new HTMLPopupSupport(
      this.graphComponent,
      window.document.getElementById('nodePopupContent')!,
      nodeLabelModel.createParameter(ExteriorNodeLabelModelPosition.TOP),
    )

    // Creates the edge pop-up for the edge pop-up template with a suitable label model parameter
    // We use the EdgePathLabelModel for the edge pop-up
    const edgeLabelModel = new EdgePathLabelModel({ autoRotation: false })

    // Creates the pop-up for the edge pop-up template
    const edgePopup = new HTMLPopupSupport(
      this.graphComponent,
      window.document.getElementById('edgePopupContent')!,
      edgeLabelModel.createRatioParameter(),
    )

    // The following works with both GraphEditorInputMode and GraphViewerInputMode
    const inputMode = this.graphComponent.inputMode as GraphInputMode

    // The pop-up is shown for the currentItem thus nodes and edges should be focusable
    inputMode.focusableItems = GraphItemTypes.NODE | GraphItemTypes.EDGE

    // Register a listener that shows the pop-up for the currentItem
    this.graphComponent.selection.addEventListener(
      'item-added',
      (event: ItemEventArgs<IModelItem>): void => {
        const item = event.item
        if (item instanceof INode) {
          // update data in node pop-up
          this.updateNodePopupContent(this.nodePopup, item)
          // open node pop-up and hide edge pop-up
          this.nodePopup.currentItem = item
          edgePopup.currentItem = null
        } else if (item instanceof IEdge) {
          // update data in edge pop-up
          this.updateEdgePopupContent(edgePopup, item)
          // open edge pop-up and node edge pop-up
          edgePopup.currentItem = item
          this.nodePopup.currentItem = null
        } else {
          this.nodePopup.currentItem = null
          edgePopup.currentItem = null
        }
      },
    )
    this.graphComponent.selection.addEventListener(
      'item-removed',
      (event: ItemEventArgs<IModelItem>): void => {
        if (!event.item) {
          this.nodePopup.currentItem = null
          edgePopup.currentItem = null
          return
        }
      },
    )

    // On clicks on empty space, hide the popups
    inputMode.addEventListener('canvas-clicked', () => {
      this.nodePopup.currentItem = null
      edgePopup.currentItem = null
    })

    // On press of the ESCAPE key, set currentItem to <code>null</code> to hide the pop-ups
    inputMode.keyboardInputMode.addKeyBinding('Escape', ModifierKeys.NONE, () => {
      this.graphComponent.currentItem = null
    })
  }

  updateNodePopupContent(nodePopup: HTMLPopupSupport, node: INode) {
    // get business data from node tag
    const id = node.tag
    this.knwl.getClass(id).then((data: any) => {
      // get all divs in the pop-up
      const divs = nodePopup.div.getElementsByTagName('div')
      for (let i = 0; i < divs.length; i++) {
        const div = divs.item(i)!
        if (div.hasAttribute('data-id')) {
          // if div has a 'data-id' attribute, get content from the business data
          const id = div.getAttribute('data-id')!
          const link = div.children[1] as HTMLLinkElement
          if (id === 'id') {
            //make a <a> rather than text
            const short = this.toShortForm(data[id])
            link.href = `http://dbpedia.org/ontology/${short}`
            link.textContent = `dbpedia:${short}`
          } else {
            link.textContent = data[id]
          }
        }
      }
    })
  }

  updateEdgePopupContent(edgePopup: HTMLPopupSupport, edge: IEdge) {
    // get business data from node tags
    const edgeData = edge.tag
    const sourceData = edge.sourcePort.owner.tag
    const targetData = edge.targetPort.owner.tag

    const font = new Font(defaultFontFamily, 12)
    const size = new Size(200, 20)
    const wrapping = TextWrapping.WRAP_CHARACTER_ELLIPSIS

    const sourceText = edgePopup.div.querySelector('*[data-id="sourceName"]') as SVGTextElement
    TextRenderSupport.addText(sourceText, this.toShortForm(sourceData), font, size, wrapping)
    sourceText.setAttribute('title', this.toShortForm(sourceData))

    const linkText = edgePopup.div.querySelector('*[data-id="linkName"]') as SVGGElement
    const linkSize = new Size(170, 20)
    const linkFont = new Font(defaultFontFamily, 12, 'normal', 'bold')
    const linkShort = this.toShortForm(edgeData.uri)
    TextRenderSupport.addText(linkText, linkShort, linkFont, linkSize, wrapping)
    const linkAnchor = linkText.parentElement!
    linkAnchor.setAttribute('href', `http://dbpedia.org/ontology/${linkShort}`)
    linkText.setAttribute('title', linkShort)

    const targetText = edgePopup.div.querySelector('*[data-id="targetName"]') as SVGTextElement
    TextRenderSupport.addText(targetText, this.toShortForm(targetData), font, size, wrapping)
    targetText.setAttribute('title', this.toShortForm(targetData))
  }

  /**
   * Shortens the Uri to something one can display.
   */
  toShortForm(uri: any | Array<any>): string | any {
    if (typeof uri === 'string') {
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
    } else if (Array.isArray(uri)) {
      uri.map((u: any) => this.toShortForm(u))
    } else {
      return uri.toString()
    }
  }

  async assembleGraph(data: { nodes: any; links: any }) {
    const builder = new GraphBuilder(this.graphComponent.graph)
    builder.createNodesSource({ data: data.nodes, id: null })
    builder.createEdgesSource({ data: data.links, sourceId: 'from', targetId: 'to' })
    builder.addEventListener('node-created', (event, sender) => {
      sender.graph.addLabel(event.item, this.toShortForm(event.item.tag))
    })
    this.graphComponent.graph = builder.buildGraph()
    await this.graphComponent.fitGraphBounds()

    await this.layoutHierarchical()
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

    mode.toolTipInputMode.toolTipLocationOffset = new Point(10, 10)
    mode.addEventListener('query-item-tool-tip', (event) => {
      if (event.item instanceof INode && !event.handled) {
        const nodeName = event.item.tag
        if (nodeName != null) {
          event.toolTip = nodeName
          event.handled = true
        }
      }
    })
    mode.itemHoverInputMode.hoverCursor = Cursor.POINTER
    mode.itemHoverInputMode.hoverItems = GraphItemTypes.NODE | GraphItemTypes.EDGE
    mode.itemHoverInputMode.ignoreInvalidItems = true
    mode.itemHoverInputMode.addEventListener('hovered-item-changed', (event) => {
      const item = event.item
      const highlightIndicatorManager = this.graphComponent.highlightIndicatorManager
      highlightIndicatorManager.items.clear()
      if (item) {
        highlightIndicatorManager.items.add(item)
        if (item instanceof INode) {
          this.graphComponent.graph.edgesAt(item).forEach((edge) => {
            highlightIndicatorManager.items.add(edge)
          })
        } else if (item instanceof IEdge) {
          highlightIndicatorManager.items.add(item.sourceNode)
          highlightIndicatorManager.items.add(item.targetNode)
        }
      }
    })
    this.graphComponent.inputMode = mode
  }

  layoutCircular() {
    return this.runLayout(
      new CircularLayout({
        partitionDescriptor: { style: 'disk' },
      }),
    )
  }

  layoutOrganic() {
    return this.runLayout(
      new OrganicLayout({
        defaultPreferredEdgeLength: 200,
      }),
    )
  }

  layoutHierarchical() {
    return this.runLayout(
      new HierarchicalLayout({
        nodeLabelPlacement: 'consider',
        defaultEdgeDescriptor: {
          routingStyleDescriptor: {
            defaultRoutingStyle: 'polyline',
            selfLoopRoutingStyle: 'octilinear',
            backLoopRoutingStyle: 'octilinear',
          },
        },
      }),
    )
  }

  runLayout(layout: ILayoutAlgorithm) {
    return this.graphComponent.applyLayoutAnimated(layout)
  }

  async zoomToLocation(item: INode) {
    const location = this.getFocusPoint(item)

    await this.graphComponent.zoomToAnimated(1.5, location)
    // display the popup info as well
    this.updateNodePopupContent(this.nodePopup, item)
    this.nodePopup.currentItem = item
  }

  /**
   * Returns the point corresponding to the given INode.
   */
  getFocusPoint(item: IModelItem): Point {
    if (item instanceof IEdge) {
      // If the source and the target node are in the view port, then zoom to the middle point of the edge
      const targetNodeCenter = item.targetNode.layout.center
      const sourceNodeCenter = item.sourceNode.layout.center
      const viewport = this.graphComponent.viewport
      if (viewport.contains(targetNodeCenter) && viewport.contains(sourceNodeCenter)) {
        return new Point(
          (sourceNodeCenter.x + targetNodeCenter.x) / 2,
          (sourceNodeCenter.y + targetNodeCenter.y) / 2,
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
    } else if (item instanceof INode) {
      return item.layout.center
    }
    return Point.ORIGIN
  }

  /**
   * Defines the various interactions in the app.
   */
  initializeInteractions() {
    document.querySelector<HTMLButtonElement>('#navFit')!.addEventListener('click', () => {
      void this.graphComponent.fitGraphBounds({ animated: true })
    })

    const overviewContainer = document.querySelector<HTMLDivElement>('.overview-container')!
    document.querySelector<HTMLButtonElement>('#navOverview')!.addEventListener('click', () => {
      overviewContainer.style.opacity = overviewContainer.style.opacity === '0' ? '1' : '0'
    })
    document.querySelector<HTMLButtonElement>('#navCircular')!.addEventListener('click', () => {
      void this.layoutCircular()
    })
    document.querySelector<HTMLButtonElement>('#navOrganic')!.addEventListener('click', () => {
      void this.layoutOrganic()
    })
    document.querySelector<HTMLButtonElement>('#navHierarchical')!.addEventListener('click', () => {
      void this.layoutHierarchical()
    })

    const search = document.querySelector<HTMLInputElement>('#search-stuff')!
    search.addEventListener('keypress', (e) => {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        const term = search.value
        search.value = ''
        const ns = this.graphComponent.graph.nodes
        for (let i = 0; i < ns.size; i++) {
          const n = ns.get(i)
          if (n.tag.toLowerCase().indexOf(term) > -1) {
            void this.zoomToLocation(n)
            return
          }
        }
      }
    })
  }
}

new App()
