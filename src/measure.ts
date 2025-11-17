import { onCleanup, type Signal } from "solid-js";

import { type Scroll } from "./scroll";



export interface Measure<Model>{
	scheduleMesure: (item: Model, el: HTMLElement) => void;
	/** Has a mesurement: even when it's outdated. */ 
	has: (id: string) => boolean;
	/** Get a mesurement: even when it's outdated. */ 
	get: (id: string) => number | undefined;
	/** Deletes measurement for a model. */ 
	delete: (id: string) => void;
	/** Invalidates measurement for a model but keep it until it re-measured. */ 
	invalidate: (id: string) => void;
	/** If a model does not have a relevant mesurement. */ 
	isRequiredMesure: (id: string) => boolean;	
}

/**
 * Measuremens for items in case when items have variable heights.
 */
export function createItemsMeasusrer<Model extends { id: string }>(
	expectedItemHeight: number,
	onMeasure: (measure: Measurement) => void,
): Measure<Model> {
	const invalidItemHeights = new Set<string>();
	const itemsHeights = new Map<string, number>();
	const itemsToMeasure = new Map<Model, HTMLElement>();
	let itemMarginTop: number;
	let measureAnimationFrameID = -1;

	function measure() {
		const measurement: Measurement = {
			measuredItemsDelta: new Map<string, number>(),
			compoundMeasuredHeightDelta: 0,
		};
		let newItemMarginValue = 0;
		let firstWithMargin: HTMLElement|null = null;
		itemsToMeasure.forEach((elem, model) => {
			const expected = itemsHeights.get(model.id) || expectedItemHeight;
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
			const actual = (itemMarginTop || 0) + height;
			measurement.compoundMeasuredHeightDelta += actual - expected;
			itemsHeights.set(model.id, actual);
			measurement.measuredItemsDelta.set(model.id, actual - expected);
			if (invalidItemHeights.has(model.id)) invalidItemHeights.delete(model.id);
		});
		if (!itemMarginTop) itemMarginTop = 0;
		if (newItemMarginValue && firstWithMargin) {
			console.log('🟠 Margin!');
			// (B) Now we need to add margin to the fist measured elements
			// that were saved without it.
			for (const [model, element] of itemsToMeasure) {
				if (element === firstWithMargin) break; // until first elem with margin met
				itemsHeights.set(model.id, itemsHeights.get(model.id)! + itemMarginTop);
				measurement.measuredItemsDelta.set(
					model.id,
					measurement.measuredItemsDelta.get(model.id)! + itemMarginTop
				)
			}
		}
		measureAnimationFrameID = -1;
		itemsToMeasure.clear();

		// Output!
		onMeasure(measurement);
	}

	function scheduleMesure(item: Model, el: HTMLElement) {
		// Add to measuring
		itemsToMeasure.set(item, el);
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
		delete: (id: string) => {
			invalidItemHeights.delete(id);
			return itemsHeights.delete(id);
		},
		invalidate: (id: string) => invalidItemHeights.add(id),
		isRequiredMesure: (id: string) => (invalidItemHeights.has(id) || !itemsHeights.has(id)),
	}
}

export interface Measurement{

	// measuredItems: Map<string, Model>;
	measuredItemsDelta: Map<string, number>;
	compoundMeasuredHeightDelta: number;

}
