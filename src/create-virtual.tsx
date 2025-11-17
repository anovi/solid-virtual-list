import type { Accessor, JSX, JSXElement, ComponentProps } from 'solid-js';
import { unwrap, type SetStoreFunction } from 'solid-js/store';
import { createContext, createMemo, createSignal, on, createComputed, onMount, useContext } from 'solid-js';

import { compareArraysById } from './some';
import { trackScroll, type Scroll } from './scroll';
import { HeightData } from './height';
import { Render } from './render';
import { createItemsMeasusrer } from './measure';



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
	const { models } = params;
	const defaultItemHeight = params.itemHeight || params.expectedItemHeight || 35;
	const renderingBufferSize = params.renderBeyondFold || 0;
	const Scroll = trackScroll();

	// Per cycle cache
	let renderCache: Render<Model> = new Render((() => undefined));
	let modelsCache: Model[];

	// Optional: Created if items has no fixed height: `itemHeight` param is not present
	let measurer: ReturnType<typeof createItemsMeasusrer>|undefined;

	// Output signals for Content component for sizing the content box and positioning items inside it.
	const [contentHeight, setContentHeight] = createSignal<number>(0);
	const [itemsWrapperTop, setItemsWrapperTop] = createSignal(0);

	// Make diff on model changes and update measurements cache
	createComputed(on(models, () => {
		if (measurer && modelsCache) {
			const diff = compareArraysById(modelsCache, unwrap(models()), 'id');
			diff.changed.forEach(changed => measurer!.invalidate(changed.id));
			diff.removed.forEach(removed => measurer!.delete(removed.id));
			console.log(diff)
		}
	}));

    const itemsMemo = createMemo<JSXElement[]>(on(
		// Dependencies
		[models, Scroll.getContentOffsetTop, Scroll.getVieportHeight, Scroll.getScrollTop],
        // Calculation of: rendered items, Content Height, Top position of Items Wrapper.
		() => {
			if (Scroll.getVieportHeight() === 0) return [];
			const Height = new HeightData(Scroll, renderingBufferSize, defaultItemHeight);
			const newRender = new Render(params.itemComponent, measurer);
            const modelsItems = unwrap(models());

			console.log(
				'Scroll:', Scroll.getScrollTop(),
				' Vieport:', Scroll.getVieportHeight(),
			);

            for (let index = 0; index < modelsItems.length; index++) {
                const model = modelsItems[index];

				// Get item height: fixed OR measured OR expected size
				const curItemHeight = measurer && measurer.has(model.id) ? measurer.get(model.id)! : defaultItemHeight;

				if (!Height.isInVieport(curItemHeight)) {
					Height.addNonVisible(model.id, curItemHeight);
					continue;
				}

                //⬇️ BELOW: Items that will actually be rendered.
				Height.addVisible(model.id, curItemHeight);

                if (renderCache.has(model.id)) {
					// console.log(model);
					// const diff = compareArraysById(modelsCache, unwrap(models()), 'id');
					// console.log(diff);
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
			modelsCache = modelsItems;

			// Triggers DOM updates
			setContentHeight(Height.compoundedHeight);
			setItemsWrapperTop(Height.firstRenderedItemTop);

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

	// Outer container (scrollable) of virtual list
	function onRootMount(el: HTMLElement) {
		Scroll.setRootElement(el);
		if (params.itemHeight === undefined) {
			// measuring of dynamic items height is required
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
