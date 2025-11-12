/* eslint-disable complexity */
import type { Accessor, JSX, JSXElement } from 'solid-js';
import { createMemo, createRoot, createSignal } from 'solid-js';


/** REQUIREMENTS
 * - [ ] track window resizing
 * - [ ] track container size changes
 * - [x] track model changes
 * - [x] remember collapsed items (though it may not be its responsibility, but parent's)
 * - [x] handle instant change of scroll position (for example scroll to a sertain item);
 * 		 or start positioning at the first render
*/


/** VIRTUAL LIST ITEMSM RENDERING
 * 
 * ## ⬇️ SCROLL DOWN
 * 
 * | Item 1       |     | Item 1       |
 * | Item 2       |     | Item 2       |
 * | Item 3       |     | Item 3       |
 * ----VIEWPORT----     | Item 4       |
 * | Item 4       |     ----VIEWPORT----
 * | Item 5       |     | Item 5       |
 * | Item 6       |     | Item 6       |
 * | Item 7       |     | Item 7       |
 * | Item 8       |     | Item 8       |
 * | Item 9       |     | Item 9       |
 * ----------------     | Item 10      |
 * | Item 10      |     ----------------
 * | Item 11      |     | Item 11      |
 * | Item 12      |     | Item 12      |
 * 
 * Item 4 should be removed
 * Item 10 should be added
 * 
 * ## ⬆️ SCROLL UP
 * 
 * | Item 1       |     | Item 1       |
 * | Item 2       |     | Item 2       |
 * | Item 3       |     ----VIEWPORT----
 * ----VIEWPORT----     | Item 3       |
 * | Item 4       |     | Item 4       |
 * | Item 5       |     | Item 5       |
 * | Item 6       |     | Item 6       |
 * | Item 7       |     | Item 7       |
 * | Item 8       |     | Item 8       |
 * | Item 9       |     ----------------
 * ----------------     | Item 9       |
 * | Item 10      |     | Item 10      |
 * | Item 11      |     | Item 11      |
 * | Item 12      |     | Item 12      |
 * 
 * I need:
 * - The height of the viewport
 * - The height of the items
 * - The scroll position
 * - The items models
 * 
 * 🟢 On update:
 * 1. Calculate the delta of scroll position
 * 2. Detect if the items has changed
 * 3. Detect if the viewport has changed
 * 4. Calculate the new range of items to render
 * 5. Loop through the items:
 *   - If the item is in the range, check if it was rendered before,
 *     if it was, check the model, if it's the same, reuse the element
 *   - if it's different, create a new element; dispose the old one
 * 
 */


/** Memorized rendererd item */
interface RenderedItem<Model> {
    model: Model;
    element: JSXElement;
    dispose: () => void;
}

enum ScrollState {
	IDLE = 1,
	DOWN = 2,
	UP = 3,
}

export interface VirtualList {
	/**
	 * Items render memo.
	 * It rerenders every time, when scroll position, window size, or models list changes.
	 */
	items: Accessor<JSXElement>;
	/**
	 * Items wrapper top positoin. Items should be wrapped in element with absolute positioning
	 * and top property assigned from this getter.
	 */
	itemsWrapperTop: Accessor<number>,
	/**
	 * Height of the spacer element that makes srollable wrapper to have a scroll.
	 */
	height: Accessor<number>,
	/**
	 * Onces scrollable element is rendered, pass it to this callback.
	 */
	scrollElem: (elem: HTMLElement) => void,

	cleanup: () => void;
}

/**
 * Creates virtual list.
 */
export function createVirtualList<Model extends object>(params: {
    models: Accessor<Model[]>,
    itemHeight?: number,
	itemMargins?: { top?: number, bottom?: number}
	expectedItemHeight?: number,
	renderBeyondFold?: number,
    getElement: (item: Model, index: number, ref: (elem: HTMLElement) => void) => JSX.Element
}) { 
	const {
		models,
		itemHeight,
		getElement,
	} = params;
	const expectedItemHeight = params.expectedItemHeight || 35;
	const offset = params.renderBeyondFold || 0;

    // Cache of previous items
    let cache: Map<Model, RenderedItem<Model>> = new Map();

	// Measurements
	const itemsHeights = new WeakMap<Model, number>();
	const [scrollTop, setScrollTop] = createSignal<number>(0);
	const [height, setHeight] = createSignal<number>(0);
	const [viewportHeight, setViewportHeight] = createSignal<number>(0);
	let itemMarginTop: number;

	const getItemHeight = (typeof itemHeight === 'number')
		? () => itemHeight
		: (model: Model) => {
			return itemsHeights.has(model) ? itemsHeights.get(model)! : expectedItemHeight;
		};

	const itemsToMeasure = new Map<Model, HTMLElement>();
	let measureAnimationFrameID = -1;

	function measure() {
		const nonMeasured = itemsToMeasure.size;
		let compoundMeasuredHeight = 0;
		let newItemMarginValue = 0;
		let firstWithMargin: HTMLElement|null = null;
		// console.log('Measuring', nonMeasured, 'items');
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
			compoundMeasuredHeight += (itemMarginTop || 0) + height;
			itemsHeights.set(model, (itemMarginTop || 0) + height);
		})
		if (!itemMarginTop) itemMarginTop = 0;
		if (newItemMarginValue && firstWithMargin) {
			// (B) Now we need to add margin to the fist measured elements
			// that were saved without it.
			for (const [model, element] of itemsToMeasure) {
				if (element === firstWithMargin) break; // until first elem with margin met
				itemsHeights.set(model, itemsHeights.get(model)! + itemMarginTop);
			}
		}
		measureAnimationFrameID = -1;
		itemsToMeasure.clear();
	
		if (!itemHeight && scrollState === ScrollState.UP && nonMeasured > 0)
			ajustAfterRenderingNonMeasuredItemsAbove(nonMeasured, compoundMeasuredHeight);
	}

	// if scroll position started at the bottom, the items above not yet mesured.
	// When I scroll up, X non-mesured items are rendered. Their height might be
	// different from expected. It creates visual disruption.
	// 
	// To avoid that, after the items are mesured, we need to ajust:
	// - scroll top position
	// - height of the the whole list
	function ajustAfterRenderingNonMeasuredItemsAbove(items: number, compoundHeight: number) {
		const fromTop = scrollTop();
		const expectedHeight = items * expectedItemHeight; 

		// often bigger than expected
		const heightDelta = compoundHeight - expectedHeight;

		scrollElem.scroll({ top: fromTop + heightDelta});
		setHeight(height() + heightDelta);
	}

	function scheduleMesure() {
		if (itemsToMeasure.size === 0 || measureAnimationFrameID > -1) return;
		queueMicrotask(() => {
			if (itemsToMeasure.size === 0 || measureAnimationFrameID > -1) return;
			measureAnimationFrameID = window.requestAnimationFrame(measure);
			// console.log('Measurement scheduled:', animationFrame)
		})
	}
	
	/* Scroll tracking */
	function setScrollElem(elem: HTMLElement) {
		scrollElem = elem;
		elem.addEventListener('scroll', onScroll);
	}
    let scrollElem: HTMLElement;
    let scrollAnimationFrameID = -1;
    let scrollState: ScrollState = ScrollState.IDLE;
	let ticking = false;

	function measureContainer() {
		const delta = scrollElem.scrollTop - scrollTop();
		setScrollTop(scrollElem.scrollTop);
		setViewportHeight(scrollElem.clientHeight);
		if (delta !== 0) {
			scrollState = delta > 0 ? ScrollState.DOWN : ScrollState.UP;
		} else {
			scrollState = ScrollState.IDLE;
		}
		ticking = false;
	}

    function onScroll() {
        if (!ticking) { 
            scrollAnimationFrameID = requestAnimationFrame(measureContainer);
            ticking = true;
        }
    }

	const [itemsWrapperTop, setItemsWrapperTop] = createSignal(0);

    const itemsMemo = createMemo<JSXElement[]>(
        () => {
			const items: JSXElement[] = [];

            // Cache of current cycle
            const modelsItems = models();
            const currentCache: Map<Model, RenderedItem<Model>> = new Map();
            const fromTop = scrollTop();
            
            let itemsHeightCompounded = 0;
            let index = 0;
			let topRenderedItem = -1;

            for (index; index < modelsItems.length; index++) {
                const item = modelsItems[index];
                const itemTop = itemsHeightCompounded;
				const itemHeight = getItemHeight(item);
				
                if (!shouldRender(
					itemsHeightCompounded,
					itemsHeightCompounded + itemHeight,
					fromTop - offset, // offset adds reserved items above viewport
					fromTop + viewportHeight() + offset // offset adds reserved items below viewport
				)) {
					itemsHeightCompounded += itemHeight;
					continue;
				}
				itemsHeightCompounded += itemHeight;

                //⬇️ BELOW: Items that will actually be rendered.
				
                if (topRenderedItem < 0) topRenderedItem = itemTop;
                let node: JSXElement;

                // Check if element will be reused or rerendered
                if (cache.has(item)) {
                    currentCache.set(item, cache.get(item)!)
                    node = cache.get(item)!.element;
					cache.delete(item); // so it's not disposed
                } else {
                    node = createRoot((dispose) => {
                        // new item
                        currentCache.set(item, {
                            model: item,
                            element: null,
                            dispose: dispose,
                        });
                        return getElement(item, index, (el) => {
							if (!itemsHeights.has(item)) {
								// Add to measuring
								itemsToMeasure.set(item, el);
								scheduleMesure();
							}
						});
                    });
                    currentCache.get(item)!.element = node;
                }
                items.push(node);
            }

            // Dispose prev items that not reused
            for (const [key, item] of cache) {
                item.dispose();
                cache.delete(key);
            }

            // Update caches
            cache = currentCache;

			setHeight(itemsHeightCompounded);
			setItemsWrapperTop(topRenderedItem);

			return items;
        }
    );


	const virtualList: VirtualList = {
		items: itemsMemo,
		height,
		scrollElem: setScrollElem,
		itemsWrapperTop,
		cleanup() {
			if (measureAnimationFrameID) cancelAnimationFrame(measureAnimationFrameID);
			if (scrollAnimationFrameID) cancelAnimationFrame(scrollAnimationFrameID);
		},
	}

	return virtualList;
}

function shouldRender(posFrom: number, posTo: number, viewPortTop: number, viewPortBottom: number) {
    return posFrom < viewPortBottom && posTo > viewPortTop;
}



type ScrollTarget = Window | Document | Element;

interface OnScrollEndOptions {
	/** How long (ms) position must stay unchanged to count as "stopped". Default: 120 */
	quietMs?: number;
	/** Optional AbortSignal to auto-cleanup. */
	signal?: AbortSignal;
	onStartScroll?: () => void;
	onScroll?: () => void,
}

/**
* Listen for scrolling to stop on a target and run `cb`.
* Returns a cleanup function.
*/
export function onScrollEnd(
	target: ScrollTarget = window,
	scrollEndCb: () => void,
	options: OnScrollEndOptions = {},
): () => void {
	const { quietMs = 120, signal } = options;
	const isWinLike = target === window || target === document || target === document.scrollingElement;
	
	const getPos = (): number => isWinLike
		? (window.scrollY || document.documentElement.scrollTop || 0)
		: (target as Element).scrollTop;
	
	let rafId: number | null = null;
	let lastPos = getPos();
	let lastChange = performance.now();
	let running = false;
	
	const loop = () => {
		const now = performance.now();
		const pos = getPos();
		// if (options.onStartScroll) options.onStartScroll(); // experiment
		if (pos !== lastPos) {
			if (options.onScroll) options.onScroll(); // experiment
			lastPos = pos;
			lastChange = now;
		}
		if (now - lastChange >= quietMs) {
			running = false;
			rafId = null;
			scrollEndCb(); // scrolling stopped
			return;
		}
		rafId = requestAnimationFrame(loop);
	};
	
	const onScroll = () => {
		if (!running) {
			running = true;
			lastPos = getPos();
			lastChange = performance.now();
			rafId = requestAnimationFrame(loop);
		}
	};
	
	// NB: passive for perf; Element/Window both accept it
	const opts: AddEventListenerOptions = { passive: true };
	const eventTarget: EventTarget =
	isWinLike ? window : (target as Element);
	
	eventTarget.addEventListener('scroll', onScroll, opts);
	
	const cleanup = () => {
		eventTarget.removeEventListener('scroll', onScroll, opts);
		if (rafId != null) cancelAnimationFrame(rafId);
	};
	
	if (signal) {
		if (signal.aborted) cleanup();
		else signal.addEventListener('abort', cleanup, { once: true });
	}
	
	return cleanup;
}


