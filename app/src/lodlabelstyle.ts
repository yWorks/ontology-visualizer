import {
  Constructor,
  GeneralPath,
  ICanvasContext,
  IInputModeContext,
  ILabel,
  ILabelStyleRenderer,
  IRenderContext,
  LabelStyle,
  LabelStyleBase,
  Point,
  Rect,
  Size,
  Visual,
} from '@yfiles/yfiles'

export class LODLabelStyleDecorator extends LabelStyleBase {
  get renderer(): ILabelStyleRenderer {
    return this.wrappedStyle.renderer
  }

  constructor(
    private wrappedStyle: LabelStyle,
    private zoomThreshold: number,
  ) {
    super()
  }

  createVisual(context: IRenderContext, label: ILabel) {
    return context.canvasComponent.zoom < this.zoomThreshold
      ? null
      : this.wrappedStyle.renderer.getVisualCreator(label, this.wrappedStyle).createVisual(context)
  }

  updateVisual(context: IRenderContext, oldVisual: Visual, label: ILabel) {
    return context.canvasComponent.zoom < this.zoomThreshold
      ? null
      : this.wrappedStyle.renderer
          .getVisualCreator(label, this.wrappedStyle)
          .updateVisual(context, oldVisual)
  }

  protected getPreferredSize(label: ILabel): Size {
    return this.wrappedStyle.renderer.getPreferredSize(label, this.wrappedStyle)
  }

  protected getBounds(context: ICanvasContext, label: ILabel): Rect {
    return context.canvasComponent.zoom < this.zoomThreshold
      ? Rect.EMPTY
      : super.getBounds(context, label)
  }

  protected isInPath(context: IInputModeContext, path: GeneralPath, label: ILabel): boolean {
    return (
      context.canvasComponent.zoom >= this.zoomThreshold &&
      this.wrappedStyle.renderer.getLassoTestable(label, this.wrappedStyle).isInPath(context, path)
    )
  }

  protected isVisible(context: ICanvasContext, rectangle: Rect, label: ILabel): boolean {
    return (
      context.canvasComponent.zoom >= this.zoomThreshold &&
      this.wrappedStyle.renderer
        .getVisibilityTestable(label, this.wrappedStyle)
        .isVisible(context, rectangle)
    )
  }

  protected isHit(context: IInputModeContext, location: Point, label: ILabel): boolean {
    return (
      context.canvasComponent.zoom >= this.zoomThreshold &&
      this.wrappedStyle.renderer.getHitTestable(label, this.wrappedStyle).isHit(context, location)
    )
  }

  protected isInBox(context: IInputModeContext, rectangle: Rect, label: ILabel): boolean {
    return (
      context.canvasComponent.zoom >= this.zoomThreshold &&
      this.wrappedStyle.renderer
        .getMarqueeTestable(label, this.wrappedStyle)
        .isInBox(context, rectangle)
    )
  }

  protected lookup(label: ILabel, type: Constructor): any {
    return this.wrappedStyle.renderer.getContext(label, this.wrappedStyle).lookup(type)
  }
}
