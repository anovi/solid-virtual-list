import type { Measurement } from "./measure";
import { type Scroll } from "./scroll";


export class RangesData {
	
	readonly bufferSize: number;
	public compoundedHeight: number = 0;
	public defaultItemHeight: number;
	public firstRenderedItemTop: number = -1;
	public renderedHeights = new Map<string, number>();
	public scrollDelta: number = 0;

	constructor(scrollData: Scroll, bufferSize: number = 0, defaultItemHeight: number = 0) {
		this.scrollData = scrollData;
		this.bufferSize = bufferSize;
		this.defaultItemHeight = defaultItemHeight;
	}

	process(id: string, height: number): boolean {
		if (this.shouldProcessedItemRender(height)) {
			this.addRendered(id, height);
			return true;
		} else {
			this.addNonRendered(id, height);
			return false;
		}
	}

	isToRender(id: string) {
		return this.renderedHeights.has(id);
	}

	isAboveViewport(pos: number): boolean {
		return pos < this.scrollData.getScrollTop();
	}

	isInViewport(id: string): boolean {
		if (!this.renderedHeights.has(id)) return false;
		const viewPortTop = this.scrollData.getScrollTop();
		const viewPortBottom = viewPortTop + this.scrollData.getVieportHeight();
		let posFrom = this.firstRenderedItemTop;
		let posTo = this.firstRenderedItemTop;

		for (const [curID, curHeight] of this.renderedHeights) {
			posTo += curHeight;
			if (id === curID) return posFrom < viewPortBottom && posTo > viewPortTop;
			posFrom += curHeight;
		}

		return false;
	}

	updateWithMeasurement(measure: Measurement) {
		// for (const [id, delta] of measure.measuredItemsDelta) {
		// 	if (this.renderedHeights.has(id)) {
		// 		this.renderedHeights.set(id, this.renderedHeights.get(id)! + delta);
		// 	}
		// }
		const viewPortTop = this.scrollData.getScrollTop();
		let posFrom = this.firstRenderedItemTop;
		let posTo = this.firstRenderedItemTop;

		for (const [curID, curHeight] of this.renderedHeights) {
			posTo += curHeight;
			/**
			 * We need to ajust scroll position if:
			 * - item is rendered
			 * - and its top edge is above viewport
			*/
			if (posFrom < viewPortTop) {
				if (measure.measuredItemsDelta.has(curID)) {
					this.scrollDelta += measure.measuredItemsDelta.get(curID)!	
				}
			} else {
				break;
			}
			posFrom += curHeight;
		}
	}

	private shouldProcessedItemRender(curItemHeight: number): boolean {
		const fromTop = this.scrollData.getScrollTop();
		const posFrom = this.scrollData.getContentOffsetTop() + this.compoundedHeight;
		const posTo = this.scrollData.getContentOffsetTop() + this.compoundedHeight + curItemHeight;
		const viewPortTop = fromTop - this.bufferSize; // offset adds reserved items above viewport
		const viewPortBottom = fromTop + this.scrollData.getVieportHeight() + this.bufferSize; // offset adds reserved items below viewport

		return posFrom < viewPortBottom && posTo > viewPortTop;
	}

	private addNonRendered(id: string, height: number,) {
		this.compoundedHeight += height;
	}

	private addRendered(id: string, height: number,) {
		if (this.firstRenderedItemTop < 0) this.firstRenderedItemTop = this.compoundedHeight;
		this.compoundedHeight += height;
		this.renderedHeights.set(id, height);
	}

	/* ------------------------------------------------------ */

	private scrollData: Scroll;

}
