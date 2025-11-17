import { onCleanup, type Signal } from "solid-js";

import { type Scroll } from "./scroll";



export interface Measure<Model>{
	scheduleMesure: (item: Model, el: HTMLElement) => void;
	has: (id: string) => boolean;
	get: (id: string) => number | undefined;
	delete: (id: string) => void;
	invalidate: (id: string) => void;
	isRequiredMesure: (id: string) => void;	
}

/**
 * Measuremens for items in case when items have variable heights.
 */
export function createItemsMeasusrer<Model extends { id: string }>(
	Scroll: Scroll,
	contentHeightSignal: Signal<number>,
	expectedItemHeight: number,
): Measure<Model> {
	const invalidItemHeights = new Set<string>();
	const itemsHeights = new Map<string, number>();
	const itemsToMeasure = new Map<Model, HTMLElement>();
	const setContentHeight = contentHeightSignal[1];
	const contentHeight = contentHeightSignal[0];
	let itemMarginTop: number;
	let firstVisibleItemToMeasure: Model|undefined = undefined;
	let measureAnimationFrameID = -1;

	function measure() {
		const nonMeasured = itemsToMeasure.size;
		let compoundMeasuredHeight = 0;
		let newItemMarginValue = 0;
		let firstWithMargin: HTMLElement|null = null;
		itemsToMeasure.forEach((elem, model) => {
			const height = elem.getBoundingClientRect().height;
			if (itemMarginTop === undefined) {
				// @ts-ignore because .value is not typed
				newItemMarginValue = elem.computedStyleMap().get('margin-top')?.value || 0;
				if (newItemMarginValue) {
					// (A) Somehow, first elements do not have calculated margin,
					// probably because they are off screen. So, we wait until
					// some element has margin value and the set it. Continue (B)
					itemMarginTop = newItemMarginValue;
					firstWithMargin = elem;
				}
			}
			if (firstVisibleItemToMeasure === model) firstVisibleItemToMeasure = undefined;
			compoundMeasuredHeight += (itemMarginTop || 0) + height;
			itemsHeights.set(model.id, (itemMarginTop || 0) + height);
			if (invalidItemHeights.has(model.id)) invalidItemHeights.delete(model.id);
		});
		if (!itemMarginTop) itemMarginTop = 0;
		if (newItemMarginValue && firstWithMargin) {
			// (B) Now we need to add margin to the fist measured elements
			// that were saved without it.
			for (const [model, element] of itemsToMeasure) {
				if (element === firstWithMargin) break; // until first elem with margin met
				itemsHeights.set(model.id, itemsHeights.get(model.id)! + itemMarginTop);
			}
		}
		measureAnimationFrameID = -1;
		itemsToMeasure.clear();
		firstVisibleItemToMeasure = undefined;
		
		// FIXME: the problem with `compoundMeasuredHeight` is that during the scroll,
		// an item whithin the viewport will be updated and it will be measured, so its
		// height will be added to `compoundMeasuredHeight` which makes an ajustment wrong
		if ( /* scrollState === ScrollState.UP && */ nonMeasured > 0)
			ajustAfterRenderingNonMeasuredItemsAbove(nonMeasured, compoundMeasuredHeight)
		// else if (!itemHeight && nonMeasured > 0)
		// 	ajustAfterRenderingNonMeasuredItemsAbove(nonMeasured, compoundMeasuredHeight)
	}

	// if scroll position started at the bottom, the items above not yet mesured.
	// When I scroll up, X non-mesured items are rendered. Their height might be
	// different from expected. It creates visual disruption.
	// 
	// To avoid that, after the items are mesured, we need to ajust:
	// - scroll top position
	// - height of the whole list
	function ajustAfterRenderingNonMeasuredItemsAbove(items: number, compoundHeight: number) {
		const fromTop = Scroll.getScrollTop();
		const expectedHeight = items * expectedItemHeight; 

		// often bigger than expected
		const heightDelta = compoundHeight - expectedHeight;

		Scroll.scroll(fromTop + heightDelta);
		setContentHeight(contentHeight() + heightDelta);
	}

	function scheduleMesure(item: Model, el: HTMLElement) {
		// Add to measuring
		itemsToMeasure.set(item, el);
		if (!firstVisibleItemToMeasure) firstVisibleItemToMeasure = item;
		queueMicrotask(() => {
			if (itemsToMeasure.size === 0 || measureAnimationFrameID > -1) return;
			measureAnimationFrameID = window.requestAnimationFrame(measure);
		})
	}

	onCleanup(() => {
		if (measureAnimationFrameID) cancelAnimationFrame(measureAnimationFrameID);
	});

	return {
		scheduleMesure,
		has: itemsHeights.has.bind(itemsHeights),
		get: itemsHeights.get.bind(itemsHeights),
		delete: itemsHeights.delete.bind(itemsHeights),
		invalidate: (id: string) => invalidItemHeights.add(id),
		isRequiredMesure: (id: string) => invalidItemHeights.has(id) || !itemsHeights.has(id),
	}
}
