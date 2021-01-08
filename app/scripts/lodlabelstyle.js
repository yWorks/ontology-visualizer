import { DefaultLabelStyleRenderer, SvgVisualGroup } from 'yfiles'

export class LODLabelStyleRenderer extends DefaultLabelStyleRenderer {
  constructor(zoomThreshold) {
    super()
    this.zoomThreshold = zoomThreshold
  }

  createVisual(context) {
    if (context.canvasComponent.zoom < this.zoomThreshold) {
      return null
    }

    const visual = super.createVisual(context)
    if (!(visual instanceof SvgVisualGroup)) {
      return visual
    }
    const rectVisual = visual.children.find((v) => v.svgElement.tagName === 'rect')
    rectVisual.svgElement.setAttribute('rx', '7px')
    return visual
  }

  updateVisual(context, oldVisual) {
    const zoom = context.canvasComponent.zoom
    if (zoom < this.zoomThreshold) {
      return null
    }

    if (oldVisual === null) {
      return this.createVisual(context)
    }

    return super.updateVisual(context, oldVisual)
  }
}
