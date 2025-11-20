import { unwrap } from 'solid-js/store'; //do we need it ?
import type { Accessor, JSX, JSXElement, ComponentProps } from 'solid-js';
import { createContext, createMemo, createSignal, on, createComputed, onMount, useContext } from 'solid-js';

import { compareArraysById } from './array';
import { trackScroll } from './scroll';
import { LayoutData } from './layout';
import { Render } from './render';
import { createItemsMeasusrer, type Measurement } from './measure';



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
export function createVirtualList<Model extends { id: string }>(params: {
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
	const modelsGetter = params.models;
	const defaultItemHeight = params.itemHeight || params.expectedItemHeight || 35;
	const renderingBufferSize = params.renderBeyondFold || 0;
	const Scroll = trackScroll();

	// Per cycle cache
	let renderCache: Render<Model> = new Render((() => undefined));
	let modelsCache: Model[];
	let layout: LayoutData;

	// Optional: Created if items has no fixed height: `itemHeight` param is not present
	let measurer: ReturnType<typeof createItemsMeasusrer>|undefined;

	// Output signals for Content component for sizing the content box and positioning items inside it.
	const [contentHeight, setContentHeight] = createSignal<number>(0);
	const [itemsWrapperTop, setItemsWrapperTop] = createSignal(0);

	// Make diff on model changes and update measurements cache.
	// It goes before Render computation, because we need to update measurer state first.
	createComputed(on(modelsGetter, () => {
		if (measurer && modelsCache) {
			const diff = compareArraysById(modelsCache, unwrap(modelsGetter()), 'id');
			diff.changed.forEach(changed => measurer!.invalidate(changed.id));
			diff.removed.forEach(removed => measurer!.delete(removed.id));
		}
	}));

	// Render computation
    const itemsMemo = createMemo<JSXElement[]>(on(
		// Dependencies
		[modelsGetter, Scroll.getContentOffsetTop, Scroll.getVieportHeight, Scroll.getScrollTop],
        // Calculation of: rendered items, Content Height, Top position of Items Wrapper.
		() => {
			if (Scroll.getVieportHeight() === 0) return [];
			layout = new LayoutData(Scroll, renderingBufferSize);
			const newRender = new Render(params.itemComponent, measurer);
            const models = unwrap(modelsGetter());

			// console.group('Render');
			// console.log(
			// 	'ScrollTop:', Scroll.getScrollTop(),
			// 	' Viewport:', Scroll.getVieportHeight(),
			// 	' Offset:', Scroll.getContentOffsetTop(),
			// );

            for (let index = 0; index < models.length; index++) {
                const model = models[index];

				// Get item height: fixed OR measured OR expected size
				const curItemHeight = measurer && measurer.has(model.id) ? measurer.get(model.id)! : defaultItemHeight;
				const isToRender = layout.process(model.id, curItemHeight);
				if (!isToRender) continue;

                if (renderCache.has(model.id)) {
					if (renderCache.isModelChanged(model)) renderCache.updateModel(model);
					newRender.takeItemFrom(model.id, renderCache);
                } else {
                    newRender.render(model, index);
                }
            }

            // Dispose previously rendered items that are not reused
            renderCache.dispose();

            // Update cache
            renderCache = newRender;
			modelsCache = models;

			// Triggers DOM updates
			setContentHeight(layout.compoundedHeight);
			setItemsWrapperTop(layout.firstRenderedItem!.top);

			// console.log('**OUTPUT**', `height: ${layout.compoundedHeight}, renderedTop: ${layout.firstRenderedItemTop}`)
			// console.groupEnd();

			return newRender.items;
        }
    ));

	const context: VirtualContextValue = {
		contentHeight,
		items: itemsMemo,
		itemsWrapperTop,
		contentElem: undefined as any,
		onContentMount(el) {
			Scroll.setContentElement(el);
		},
	};

	// Render ajustments after measuring phase
	function onMeasure(measurement: Measurement) {
		if (!layout) return;

		// Now, we need to decide:
		// (A) how to ajust scroll position and height
		// (B) and do we need more items to render, if rendered items do not cover viewport entirely.

		// console.group('On Measure')
		// console.log('Measurement', measurement)

		layout.updateWithMeasurement(measurement);

		/**
		 * Handle cases where height of mesured item is less than vieport height —
		 * we need to render more items, if possible.
		 * 
		 * ???
		*/

		/**
		 * Handle a case where:
		 * - scroll at the bottom of the list
		 * - delta is negative
		 * 
		 * Currently, it makes scroll glitch.
		 * 
		 * ???
		*/

		// Ajust rendered range
		// if (measurement.compoundMeasuredHeightDelta > 0) {
		// 	// maybe render more items below
		// } else if (measurement.compoundMeasuredHeightDelta < 0) {
		// 	// if (measurement.compoundMeasuredHeightDelta < 0 && layout.scrollDelta < 0) debugger;
		// 	// maybe render more items above
		// 	const models = unwrap(modelsGetter());
		// 	let i = layout.firstRenderedItem!.index - 1;
		// 	const toRender = [];
		// 	let curBottom = layout.firstRenderedItem!.top;
		// 	while (i > 0) {
		// 		const model = models[i];
		// 		const height = measurer!.get(model.id) || defaultItemHeight;
		// 		console.log('Check', model)
		// 		if (layout.isInViewport(curBottom)) {
		// 			// Add item to render
		// 			toRender.push(model);
		// 		} else {
		// 			break;
		// 		}
		// 		curBottom = curBottom - height;
		// 		i--;
		// 	}
		// 	console.log('☝️ To Render Above:', toRender);
		// }

		if (measurement.compoundMeasuredHeightDelta !== 0) {
			// console.log('Height Δ:', measurement.compoundMeasuredHeightDelta)
			setContentHeight(contentHeight() + measurement.compoundMeasuredHeightDelta); 
		}

		if (layout.scrollDelta !== 0) {
			/**
			 * Questions:
			 * 1. What if scroll is on the absolute end position and ajustment should prolong height and set scroll to bottom?
			 *    How order matters? If setting height is after setting scroll, then container does not have enougth space
			 *    to set scroll position.
			 * 2. Does increasing the container’s height by itself not trigger a scroll event?
			*/
			// console.log('Scroll Δ:', layout.scrollDelta)
			Scroll.ajustScroll(layout.scrollDelta); // possibly doesn't work because browser have not the render phase done yet
		}

		// console.groupEnd();
	}

	// Outer container (scrollable) of virtual list
	function onRootMount(el: HTMLElement) {
		Scroll.setRootElement(el);
		if (params.itemHeight === undefined) {
			// measuring of dynamic items height is required
			measurer = createItemsMeasusrer(defaultItemHeight, onMeasure);
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
