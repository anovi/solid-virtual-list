import { expect, describe, it, assert } from 'vitest'
import { LayoutData } from '../src/layout'
import { type Scroll } from '../src/scroll';


let currentScrollTop = 0;
let currentOffsetTop = 0;
let currentVieportHeight = 500;

const scroll: Scroll = {
	getScrollTop: () => currentScrollTop,
	getVieportHeight: () => currentVieportHeight,
	getContentOffsetTop: () => currentOffsetTop,
	ajustScroll: (top: number) => undefined,
	setRootElement: (el: HTMLElement) => undefined,
	setContentElement: (el: HTMLElement) => undefined,
}

function fillLayoutItems(layout: LayoutData, amount: number) {
	for (let index = 0; index < amount; index++) {
		layout.process(String(index), 100);
	}
}

describe('LayoutData', () => {

	it('should pass base checking', async () => {
		currentScrollTop = 0;
		const layout = new LayoutData(scroll);
		fillLayoutItems(layout, 20); // 20 models with height 100

		expect(layout, 'shoud have layout');
		expect(layout.compoundedHeight).toBe(2000);
		assert.deepEqual(layout.firstRenderedItem, { id: '0', top: 0, index: 0});
		assert.deepEqual(layout.lastRenderedItem, { id: '4', top: 400, index: 4});

		layout.updateWithMeasurement({
			measuredItemsDelta: new Map([
				['4', -50] // height of the last rendered item is 50px instead of 100px
			]),
			compoundMeasuredHeightDelta: -50,
		});
		
		expect(layout.scrollDelta).toBe(0);

		expect(layout.isInVieport(400)).toBe(true);
		expect(layout.isInVieport(499)).toBe(true);
		expect(layout.isInVieport(500)).toBe(false);

		expect(layout.renderedHeights.get('4'), 'measured height of item 4 is ajusted').toBe(50);
		expect(layout.compoundedHeight, 'compoundedHeight is ajusted').toBe(2000 - 50);
	});

	it('should have isInVieport to give ajusted values when a measurement is done', async () => {
		currentScrollTop = 500;
		const layout = new LayoutData(scroll, 100); // with buffering
		fillLayoutItems(layout, 20); // 20 models with height 100
		expect(layout.isInVieport(450)).toBe(false); // not yet ajusted 

		layout.updateWithMeasurement({
			measuredItemsDelta: new Map([
				['4', -50] //last model is 50 instead of 100
			]),
			compoundMeasuredHeightDelta: -50,
		});
		
		expect(layout.scrollDelta).toBe(-50);
		expect(layout.scrollTop, 'scrollTop is ajusted').toBe(450);

		// vieport is ajusted to a range 450–950 px
		expect(layout.isInVieport(449)).toBe(false);
		expect(layout.isInVieport(450)).toBe(true);
		expect(layout.isInVieport(949)).toBe(true);
		expect(layout.isInVieport(950)).toBe(false);

		assert.deepEqual(layout.lastRenderedItem, { id: '10', top: 950, index: 10 });
	});

	it('should handle currentOffsetTop correctly', async () => {
		/**
		 * o==========o ───┐
		 * ║//////////║    │ top offset
		 * ║----------║ ───┘
		 * ║ 0        ║
		 * ║ 1        ║
		 * ║ 2 _ _ _ _║ _____________
		 * ║ 3        ║             │ 
		 * ║==========║ ──┐         │
		 * ║ 4        ║   │         │ range of rendered
		 * ║ 5        ║   │ vieport │ items, including buffer
		 * ║ 6        ║   │ range   │
		 * ║ 7        ║   │         │
		 * ║ 8        ║   │         │
		 * ║==========║ ──┘         │
		 * ║ 9 _ _ _ _║ ____________│
		 * ║ 10       ║
		 * o==========o
		*/
		currentOffsetTop = 100;
		currentScrollTop = 500;
		currentVieportHeight = 500;
		const layout = new LayoutData(scroll, 100); // with buffering
		fillLayoutItems(layout, 20); // 20 models with height 100
		expect(layout.isInVieport(450)).toBe(false); // not yet ajusted 

		layout.updateWithMeasurement({
			measuredItemsDelta: new Map([
				['3', -50] //last model is 50 instead of 100
			]),
			compoundMeasuredHeightDelta: -50,
		});

		expect(layout.scrollDelta).toBe(-50);
		expect(layout.scrollTop, 'scrollTop is ajusted').toBe(450);

		// scroll is ajusted to a range 450–950 px
		expect(layout.isInVieport(449)).toBe(false);
		expect(layout.isInVieport(450)).toBe(true);
		expect(layout.isInVieport(949)).toBe(true);
		expect(layout.isInVieport(950)).toBe(false);

		assert.deepEqual(layout.lastRenderedItem, { id: '9', top: 950, index: 9 });
	});

});
