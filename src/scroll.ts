import { createSignal, onCleanup } from "solid-js";

export interface Scroll {

	getScrollTop: () => number,

	getVieportHeight: () => number,

	getContentOffsetTop: () => number,

	ajustScroll: (top: number) => void,

	setRootElement: (el: HTMLElement) => void;

	setContentElement: (el: HTMLElement) => void;
}

const ScrollState = {
	IDLE: 1,
	DOWN: 2,
	UP: 3,
};

/**
 * Tracks scroll of the container.
 */
export function trackScroll(): Scroll {
	const [getScrollTop, setScrollTop] = createSignal<number>(0);
	const [getVieportHeight, setViewportHeight] = createSignal<number>(0);
	const [getContentOffsetTop, setContentOffsetTop] = createSignal<number>(0);
	let scrollElem: HTMLElement;
	let contentElement: HTMLElement;
    let scrollAnimationFrameID = -1;
    let scrollState: number = ScrollState.IDLE; // TODO: why do I need this now?
	let ticking = false;
	let scrollAjustment = false;

	function setRootElement(elem: HTMLElement) {
		scrollElem = elem;
		elem.addEventListener('scroll', onScroll);
	}
    
	function measureContainer() {
		console.log('---measureContainer---')
		const delta = scrollElem.scrollTop - getScrollTop();
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
		if (scrollAjustment) return scrollAjustment = false;
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
		getScrollTop,
		/** Client height of scrollable element. */
		getVieportHeight,
		/** Offset of content wrapper from top of the outer wrapper (if outer has paddings or content besides virtual list) */
		getContentOffsetTop,
		/** Scrolls Root container to given position without trigging rerender. */
		ajustScroll: (delta: number): void => {
			scrollAjustment = true;
			scrollElem.scroll({ top: getScrollTop() + delta });
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
