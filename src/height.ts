import { type Scroll } from "./scroll";


export class HeightData {
	
	readonly bufferSize: number;
	readonly itemsHeights = new Map<string, number>();
	public compoundedHeight: number = 0;
	public defaultItemHeight: number;
	public firstRenderedItemTop: number = -1;

	constructor(scrollData: Scroll, bufferSize: number = 0, defaultItemHeight: number = 0) {
		this.scrollData = scrollData;
		this.bufferSize = bufferSize;
		this.defaultItemHeight = defaultItemHeight;
	}

	isInVieport(curItemHeight: number): boolean {
		const fromTop = this.scrollData.getScrollTop();
		const posFrom = this.scrollData.getContentOffsetTop() + this.compoundedHeight;
		const posTo = this.scrollData.getContentOffsetTop() + this.compoundedHeight + curItemHeight;
		const viewPortTop = fromTop - this.bufferSize; // offset adds reserved items above viewport
		const viewPortBottom = fromTop + this.scrollData.getVieportHeight() + this.bufferSize; // offset adds reserved items below viewport

		return posFrom < viewPortBottom && posTo > viewPortTop;
	}

	isAboveViewport(pos: number): boolean {
		return pos < this.scrollData.getScrollTop();
	}

	addNonVisible(id: string, height: number,) {
		this.compoundedHeight += height;
		this.itemsHeights.set(id, height);
	}

	addVisible(id: string, height: number,) {
		if (this.firstRenderedItemTop < 0) this.firstRenderedItemTop = this.compoundedHeight;
		this.compoundedHeight += height;
		this.itemsHeights.set(id, height);
	}

	remove(id: string) {
		this.itemsHeights.delete(id);
	}

	has(id: string) {
		this.itemsHeights.has(id);
	}

	clear() {
		this.itemsHeights.clear();
	}

	/* ------------------------------------------------------ */

	private scrollData: Scroll;

}
