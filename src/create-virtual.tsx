import type { Accessor, JSX, JSXElement, ComponentProps, Signal, } from 'solid-js';
import { createContext, createMemo, createRoot, createSignal, onCleanup, onMount, useContext } from 'solid-js';


export interface VirtualList {
	/**
	 * Root scrollable element of virtual list. Should have restricted height and `position: relative`.
	 */
	Root: (props: JSX.HTMLAttributes<HTMLDivElement>) => JSX.Element,
	/**
	 * Content element of virtual list. Put it as a child of Root element, among with other content (if needed).
	*/
	Content: (props: JSX.HTMLAttributes<HTMLDivElement>) => JSX.Element;
}

/** Memorized renderered item */
interface RenderedItem<Model> {
    model: Model;
    element: JSXElement;
    dispose: () => void;
}

const ScrollState = {
	IDLE: 1,
	DOWN: 2,
	UP: 3,
};

type VirtualContextValue = {
	contentHeight: Accessor<number>,
	items: Accessor<JSXElement>,
	itemsWrapperTop: Accessor<number>,
	contentElem: HTMLElement,
	onContentMount: (el: HTMLElement) => void,
};

const VirtualContext = createContext<VirtualContextValue>(undefined);

/**
 * Creates virtual list.
 */
export function createVirtualList<Model extends object>(params: {
    models: Accessor<Model[]>,
    itemHeight?: number,
	expectedItemHeight?: number,
	/**
	 * How much content (in pixels) to render beyond viewport.
	 * Useful to avoid glitches while scrolling fast.
	*/
	renderBeyondFold?: number,
	/**
	 * In order 
	 * Useful to avoid glitches while scrolling fast.
	*/
    itemComponent: (item: Model, index: number, ref: (elem: HTMLElement) => void) => JSX.Element
}) { 
	const { models, itemComponent } = params;
	const defaultItemHeight = params.itemHeight || params.expectedItemHeight || 35;
	const renderingBufferSize = params.renderBeyondFold || 0;
	const Scroll = trackScroll();
	
    // Cache of previous rendered items: recreated at each cycle
    let renderedItems: Map<Model, RenderedItem<Model>> = new Map();

	// Created if items has no fixed height: `itemHeight` param is not present
	let measurer: ReturnType<typeof createItemsMeasusrer>|undefined;

	// Output signals for Content component for sizing the content box and positioning items inside it.
	const [contentHeight, setContentHeight] = createSignal<number>(0);
	const [itemsWrapperTop, setItemsWrapperTop] = createSignal(0);

    const itemsMemo = createMemo<JSXElement[]>(
        () => {
			const items: JSXElement[] = [];

            // Cache of current cycle
            const modelsItems = models();
            const currentCache: Map<Model, RenderedItem<Model>> = new Map();
            const fromTop = Scroll.scrollTop();
            
            let itemsHeightCompounded = 0;
			let firstRenderedItemTop = -1;

            for (let index = 0; index < modelsItems.length; index++) {
                const item = modelsItems[index];
                const itemTop = itemsHeightCompounded;
				// Get item height: fixed OR measured OR expected size
				const curItemHeight = measurer && measurer.has(item) ? measurer.get(item)! : defaultItemHeight;

				const posFrom = Scroll.contentOffsetTop() + itemsHeightCompounded;
				const posTo = Scroll.contentOffsetTop() + itemsHeightCompounded + curItemHeight;
				const viewPortTop = fromTop - renderingBufferSize; // offset adds reserved items above viewport
				const viewPortBottom = fromTop + Scroll.viewportHeight() + renderingBufferSize; // offset adds reserved items below viewport

				// Item will be rendered, when its top or bottom edge whithin vieport
                if (!(posFrom < viewPortBottom && posTo > viewPortTop)) {
					itemsHeightCompounded += curItemHeight;
					continue;
				}
				itemsHeightCompounded += curItemHeight;

                //⬇️ BELOW: Items that will actually be rendered.
				
                if (firstRenderedItemTop < 0) firstRenderedItemTop = itemTop;
                let node: JSXElement;

                // Check if element will be reused or rerendered
                if (renderedItems.has(item)) {
                    currentCache.set(item, renderedItems.get(item)!)
                    node = renderedItems.get(item)!.element;
					renderedItems.delete(item); // so it will not be disposed
                } else {
                    node = createRoot((dispose) => {
                        // new item
                        currentCache.set(item, {
                            model: item,
                            element: null,
                            dispose: dispose,
                        });
                        return itemComponent(item, index, (el) => {
							if (measurer && !measurer.has(item)) {
								measurer.scheduleMesure(item, el);
							}
						});
                    });
                    currentCache.get(item)!.element = node;
                }
                items.push(node);
            }

            // Dispose previously rendered items that not reused
            for (const [key, item] of renderedItems) {
                item.dispose();
                renderedItems.delete(key);
            }

            // Update cache
            renderedItems = currentCache;

			// Triggers DOM updates
			setContentHeight(itemsHeightCompounded);
			setItemsWrapperTop(firstRenderedItemTop);

			return items;
        }
    );

	const context: VirtualContextValue = {
		contentHeight,
		items: itemsMemo,
		itemsWrapperTop,
		contentElem: undefined as any,
		onContentMount(el) {
			Scroll.setContentElement(el);
		},
	};

	// Outer container (scrollable) of virtual list
	function onRootMount(el: HTMLElement) {
		Scroll.setRootElement(el);
		if (params.itemHeight === undefined) {
			// When measuring of items height is required
			measurer = createItemsMeasusrer(Scroll, [contentHeight, setContentHeight], defaultItemHeight);
		}
	}

	return {
		Root: (props: ComponentProps<'div'>) => {
			return (
				<VirtualContext.Provider value={context}>
					<div {...props} ref={onRootMount} style={{ position: 'relative' }}>
						{props.children}
					</div>
				</VirtualContext.Provider>
			);
		},
		Content,
	};
}


/**
 * Content component
 */
export function Content(props: ComponentProps<'div'>) {
	const context = useContext(VirtualContext);
	if (!context) throw Error(`Virtual list "Content" component is outside of "Root" component. Make sure that "Content" is a child or "Root".`)
	let contentElem!: HTMLDivElement;
	onMount(() => {
		context.contentElem = contentElem;
		context.onContentMount(contentElem);
	});
	return (
		<div {...props} style={{ height: `${context.contentHeight()}px`, position: 'relative' }} ref={contentElem}>
			<div style={{
				position: 'absolute',
				top: context.itemsWrapperTop() + 'px',
				right: 0,
				left: 0
			}}>
				{context.items()}
			</div>
		</div>
	);
}


/**
 * Measuremens for items in case when items have variable heights.
 */
function createItemsMeasusrer<Model extends object>(
	Scroll: ReturnType<typeof trackScroll>,
	contentHeightSignal: Signal<number>,
	expectedItemHeight: number,
) {
	const itemsHeights = new WeakMap<Model, number>();
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
		// console.group('Measuring', itemsToMeasure.size)
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
			itemsHeights.set(model, (itemMarginTop || 0) + height);
			// console.log((itemMarginTop || 0) + height)
		});
		if (!itemMarginTop) itemMarginTop = 0;
		if (newItemMarginValue && firstWithMargin) {
			// (B) Now we need to add margin to the fist measured elements
			// that were saved without it.
			for (const [model, element] of itemsToMeasure) {
				if (element === firstWithMargin) break; // until first elem with margin met
				itemsHeights.set(model, itemsHeights.get(model)! + itemMarginTop);
			}
		}
		// console.groupEnd()
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
		const fromTop = Scroll.scrollTop();
		const expectedHeight = items * expectedItemHeight; 

		// often bigger than expected
		const heightDelta = compoundHeight - expectedHeight;

		Scroll.scroll(fromTop + heightDelta);
		setContentHeight(contentHeight() + heightDelta);
	}

	function scheduleMesure(item: Model, el: HTMLElement) {
		// Add to measuring
		// console.log('TO measure', el)
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
	}
}


/**
 * Tracks scroll of the container.
 */
function trackScroll () {
	const [scrollTop, setScrollTop] = createSignal<number>(0);
	const [viewportHeight, setViewportHeight] = createSignal<number>(0);
	const [contentOffsetTop, setContentOffsetTop] = createSignal<number>(0);
	let scrollElem: HTMLElement;
	let contentElement: HTMLElement;
    let scrollAnimationFrameID = -1;
    let scrollState: number = ScrollState.IDLE; // TODO: why do I need this now?
	let ticking = false;

	function setRootElement(elem: HTMLElement) {
		scrollElem = elem;
		elem.addEventListener('scroll', onScroll);
	}
    
	function measureContainer() {
		const delta = scrollElem.scrollTop - scrollTop();
		setScrollTop(scrollElem.scrollTop);
		setViewportHeight(scrollElem.clientHeight);
		setContentOffsetTop(contentElement.offsetTop);
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

	onCleanup(() => {
		if (scrollAnimationFrameID) cancelAnimationFrame(scrollAnimationFrameID);
	});

	return {
		/** Current scroll top position. */
		scrollTop,
		/** Client height of scrollable element. */
		viewportHeight,
		/** Offset of content wrapper from top of the outer wrapper (if outer has paddings or content besides virtual list) */
		contentOffsetTop,
		/** Scrolls Root container to given position */
		scroll: (top: number): void => {
			scrollElem.scroll({ top });
		},
		/** Pass the ref of root element */
		setRootElement,
		/** Pass the ref of content element */
		setContentElement: (el: HTMLElement) => {
			contentElement = el;
			measureContainer();
		},
	}

}
