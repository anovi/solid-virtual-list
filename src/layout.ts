import type { Measurement } from "./measure";
import { type Scroll } from "./scroll";


type RenderedItem = {
	top: number,
	index: number,
	id: string,
}

export class LayoutData {
	
	readonly bufferSize: number;
	public compoundedHeight: number = 0;
	public renderedHeights = new Map<string, number>();
	public firstRenderedItem: RenderedItem|undefined = undefined;
	public lastRenderedItem: RenderedItem|undefined = undefined;

	// Computed after updating with measurement
	public scrollDelta: number = 0;
	
	// May differ before and after measurement
	get scrollTop() {
		return this.scrollData.getScrollTop() + this.scrollDelta;
	}

	constructor(scrollData: Scroll, bufferSize: number = 0) {
		this.scrollData = scrollData;
		this.bufferSize = bufferSize;
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

	/** @deprecated */
	isAboveViewport(pos: number): boolean {
		return pos < this.scrollTop;
	}

	/** @deprecated possibly it's not needed */
	isInViewport(pos: number): boolean {
		const viewPortTop = this.scrollTop;
		const viewPortBottom = viewPortTop + this.scrollData.getVieportHeight();
		// console.log(`Is ${pos} in ${viewPortTop}–${viewPortBottom}`);
		return pos >= viewPortTop && pos < viewPortBottom;
	}

	/** @deprecated */
	isItemInViewport(id: string): boolean {
		if (!this.renderedHeights.has(id)) return false;
		const viewPortTop = this.scrollTop;
		const viewPortBottom = viewPortTop + this.scrollData.getVieportHeight();
		let posFrom = this.scrollData.getContentOffsetTop() + this.firstRenderedItem!.top;
		let posTo = posFrom;

		for (const [curID, curHeight] of this.renderedHeights) {
			posTo += curHeight;
			if (id === curID) return posFrom < viewPortBottom && posTo > viewPortTop;
			posFrom += curHeight;
		}

		return false;
	}

	updateWithMeasurement(measurement: Measurement) {
		const viewPortTop = this.scrollTop;
		let posFrom = this.scrollData.getContentOffsetTop() + this.firstRenderedItem!.top;

		for (const [curID, curHeight] of this.renderedHeights) {
			let ajustedHeight = curHeight;
			/**
			 * We need to ajust scroll position if:
			 * - item is rendered
			 * - and its top edge is above viewport
			*/			
			if (measurement.measuredItemsDelta.has(curID)) {
				const delta = measurement.measuredItemsDelta.get(curID)!;

				// If item starts above viewport than apply delta to scroll position
				if (posFrom < viewPortTop) this.scrollDelta += delta;

				ajustedHeight += delta;
				this.renderedHeights.set(curID, ajustedHeight)
			}
			if (curID === this.lastRenderedItem!.id)
				this.lastRenderedItem!.top = posFrom; // Change last rendered item position

			posFrom += ajustedHeight; // top position of next item
		}

		this.compoundedHeight += measurement.compoundMeasuredHeightDelta;
	}

	/* ------------------------------------------------------ */

	private scrollData: Scroll;
	private curIndex = 0;

	private shouldProcessedItemRender(curItemHeight: number): boolean {
		const scrollTop = this.scrollData.getScrollTop();
		const posFrom = this.scrollData.getContentOffsetTop() + this.compoundedHeight;
		const posTo = this.scrollData.getContentOffsetTop() + this.compoundedHeight + curItemHeight;
		const renderedTop = scrollTop - this.bufferSize; // offset adds reserved items above viewport
		const renderedBottom = scrollTop + this.scrollData.getVieportHeight() + this.bufferSize; // offset adds reserved items below viewport

		return posFrom < renderedBottom && posTo > renderedTop;
	}

	private addNonRendered(id: string, height: number,) {
		this.compoundedHeight += height;
		this.curIndex++;
	}

	private addRendered(id: string, height: number) {
		if (!this.firstRenderedItem) {
			this.firstRenderedItem = {
				top: this.compoundedHeight, // offset because it's top from items container, not root
				index: this.curIndex,
				id
			}
		}
		this.lastRenderedItem = {
			top: this.compoundedHeight, // offset because it's top from items container, not root
			index: this.curIndex,
			id
		}
		this.compoundedHeight += height;
		this.renderedHeights.set(id, height);
		this.curIndex++;
	}
}
