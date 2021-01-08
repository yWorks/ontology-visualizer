import {
  GraphComponent,
  IEdge,
  ILabelModelParameter,
  IModelItem,
  Point,
  SimpleLabel,
  Size,
} from 'yfiles'

/**
 * This class adds an HTML panel on top of the contents of the GraphComponent that can
 * display arbitrary information about a {@link IModelItem graph item}.
 * In order to not interfere with the positioning of the pop-up, HTML content
 * should be added as ancestor of the {@link HTMLPopupSupport#div div element}, and
 * use relative positioning. This implementation uses a
 * {@link ILabelModelParameter label model parameter} to determine
 * the position of the pop-up.
 */
export default class HTMLPopupSupport {
  /**
   * Constructor that takes the graphComponent, the container div element and an ILabelModelParameter
   * to determine the relative position of the popup.
   * @param {GraphComponent} graphComponent
   * @param {HTMLElement} div
   * @param {ILabelModelParameter} labelModelParameter
   */
  constructor(graphComponent, div, labelModelParameter) {
    this.graphComponent = graphComponent
    this.labelModelParameter = labelModelParameter
    this.$div = div
    this.$currentItem = null
    this.$dirty = false

    // make the popup invisible
    div.style.opacity = '0'
    div.style.display = 'none'

    this.registerListeners()
  }

  /**
   * Sets the container {@link HTMLPopupSupport#div div element}.
   * @type {HTMLElement}
   */
  set div(value) {
    this.$div = value
  }

  /**
   * Gets the container {@link HTMLPopupSupport#div div element}.
   * @type {HTMLElement}
   */
  get div() {
    return this.$div
  }

  /**
   * Sets the {@link IModelItem item} to display information for.
   * Setting this property to a value other than null shows the pop-up.
   * Setting the property to null hides the pop-up.
   * @type {IModelItem}
   */
  set currentItem(value) {
    if (value === this.$currentItem) {
      return
    }
    this.$currentItem = value
    if (value !== null) {
      this.show()
    } else {
      this.hide()
    }
  }

  /**
   * Gets the {@link IModelItem item} to display information for.
   * @type {IModelItem}
   */
  get currentItem() {
    return this.$currentItem
  }

  /**
   * Sets the flag for the current position is no longer valid.
   * @param value true if the current position is no longer valid, false otherwise
   * @type {boolean}
   */
  set dirty(value) {
    this.$dirty = value
  }

  /**
   * Gets the flag for the current position is no longer valid.
   * @type {boolean}
   */
  get dirty() {
    return this.$dirty
  }

  /**
   * Registers viewport, node bounds changes and visual tree listeners to the given graphComponent.
   */
  registerListeners() {
    // Adds listener for viewport changes
    this.graphComponent.addViewportChangedListener((sender, propertyChangedEventArgs) => {
      if (this.currentItem) {
        this.dirty = true
      }
    })

    // Adds listeners for node bounds changes
    this.graphComponent.graph.addNodeLayoutChangedListener((node, oldLayout) => {
      if (
        ((this.currentItem && this.currentItem === node) || IEdge.isInstance(this.currentItem)) &&
        (node === this.currentItem.sourcePort.owner || node === this.currentItem.targetPort.owner)
      ) {
        this.dirty = true
      }
    })

    // Adds listener for updates of the visual tree
    this.graphComponent.addUpdatedVisualListener((sender, eventArgs) => {
      if (this.currentItem && this.dirty) {
        this.dirty = false
        this.updateLocation()
      }
    })
  }

  /**
   * Makes this pop-up visible.
   */
  show() {
    this.div.style.display = 'block'
    setTimeout(() => {
      this.div.style.opacity = '1'
    }, 0)
    this.updateLocation()
  }

  /**
   * Hides this pop-up.
   */
  hide() {
    const parent = this.div.parentNode
    const popupClone = this.div.cloneNode(true)
    popupClone.setAttribute('class', `${popupClone.getAttribute('class')} popupContentClone`)
    parent.appendChild(popupClone)
    // fade the clone out, then remove it from the DOM. Both actions need to be timed.
    setTimeout(() => {
      popupClone.setAttribute('style', `${popupClone.getAttribute('style')} opacity: 0;`)
      setTimeout(() => {
        parent.removeChild(popupClone)
      }, 300)
    }, 0)
    this.div.style.opacity = '0'
    this.div.style.display = 'none'
  }

  /**
   * Changes the location of this pop-up to the location calculated by the
   * {@link HTMLPopupSupport#labelModelParameter}. Currently, this implementation does not support rotated pop-ups.
   */
  updateLocation() {
    if (!this.currentItem && !this.labelModelParameter) {
      return
    }
    const width = this.div.clientWidth
    const height = this.div.clientHeight
    const zoom = this.graphComponent.zoom

    const dummyLabel = new SimpleLabel(this.currentItem, '', this.labelModelParameter)
    if (this.labelModelParameter.supports(dummyLabel)) {
      dummyLabel.preferredSize = new Size(width / zoom, height / zoom)
      const newLayout = this.labelModelParameter.model.getGeometry(
        dummyLabel,
        this.labelModelParameter
      )
      this.setLocation(newLayout.anchorX, newLayout.anchorY - (height + 10) / zoom, width, height)
    }
  }

  /**
   * Sets the location of this pop-up to the given world coordinates.
   * @param {number} x The target x-coordinate of the pop-up.
   * @param {number} y The target y-coordinate of the pop-up.
   * @param {number} width
   * @param {number} height
   */
  setLocation(x, y, width, height) {
    // Calculate the view coordinates since we have to place the div in the regular HTML coordinate space
    const viewPoint = this.graphComponent.toViewCoordinates(new Point(x, y))
    const gcSize = this.graphComponent.innerSize
    const padding = 15
    const left = Math.min(gcSize.width - width - padding, Math.max(padding, viewPoint.x))
    const top = Math.min(gcSize.height - height - padding, Math.max(padding, viewPoint.y))
    this.div.style.left = `${left}px`
    this.div.style.top = `${top}px`
  }
}
