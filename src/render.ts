import { createEffect, createRoot, on, type JSXElement } from "solid-js";
import { createStore, reconcile, unwrap, type SetStoreFunction } from "solid-js/store";
import type { Measure } from "./measure";


/** Memorized renderered item */
export interface RenderedItem<Model> {
    model: Model;
	setModel: SetStoreFunction<Model>;
    element: JSXElement;
    dispose: () => void;
	keep: boolean;
}

export class Render<Model extends { id: string }> {

	public items: JSXElement[] = [];
	
	constructor(
		itemComponent: (item: Model, index: number, ref: (elem: HTMLElement) => void) => JSXElement,
		measurer?: Measure<Model>
	) {
		this.itemComponent = itemComponent;
		this.measurer = measurer;
	}

	has(id: string): boolean {
		return this.renderedItems.has(id);
	}

	get(id: string): RenderedItem<Model> | undefined {
		return this.renderedItems.get(id);
	}

	delete(id: string): boolean {
		return this.renderedItems.delete(id);
	}

	isModelChanged(newModel: Model): boolean {
		const renderedItem = this.renderedItems.get(newModel.id);
		if (!renderedItem) return false;
		const model = unwrap(renderedItem.model);
		return model !== newModel;
	}

	updateModel(model: Model): void {
		this.renderedItems.get(model.id)?.setModel(reconcile(model));
	}

	takeItemFrom(id: string, source: Render<Model>): void {
		const model = source.get(id);
		if (!model) return;
		this.set(id, model)
		this.items.push(model.element);
		source.delete(id); // so it will not be disposed
	}

	/** @deprecated */
	markForDisposal(id: string) {
		const model = this.renderedItems.get(id);
		if (model) model.keep = true;
	}

	dispose() {
		this.renderedItems.forEach((item) => item.dispose());
		// @ts-ignore
		delete this.renderedItems;
		// @ts-ignore
		delete this.items;
	}

	render(item: Model, index: number) {
		let renderedItem: RenderedItem<Model>;
		const node = createRoot((dispose) => {
			const [itemTrackable, setItemModel] = createStore({ ...item }); // TODO: desctructuring possibly redundant
			let htmlElem!: HTMLElement;
			// Schedule mesurement every time the model is updated.
			createEffect(on(
				// HACK: to create store as dependency it reads all properties of the model.
				() => triggerTrackableAsDependency(itemTrackable),
				() => {
					if (!htmlElem) return;
					else if (this.measurer && this.measurer.isRequiredMesure(item.id)) {
						this.measurer.scheduleMesure(item, htmlElem);
					}
				}
			));
			// new item
			renderedItem = {
				model: item,
				setModel: setItemModel,
				element: null,
				dispose: dispose,
				keep: false,
			};
			return this.itemComponent(itemTrackable, index, (el) => htmlElem = el);
		});
		renderedItem!.element = node;
		this.renderedItems.set(item.id, renderedItem!);
		this.items.push(renderedItem!.element);
		return renderedItem!;
	}

	// ---------------------------------------------------------------------------------------------------

	private set(id: string, item: RenderedItem<Model>): void {
		this.renderedItems.set(id, item);
	}

	private itemComponent: (item: Model, index: number, ref: (elem: HTMLElement) => void) => JSXElement
	// Cache of previous rendered items: recreated at each cycle
	private renderedItems: Map<string, RenderedItem<Model>> = new Map();
	private measurer?: Measure<Model>;
}


function triggerTrackableAsDependency <T extends { id: string, [key: string]: any }> (item: T): unknown[] {
	const result = [];
	for (const key in item) {
		if (!Object.hasOwn(item, key)) continue;
		if (key === 'id') continue;
		result.push(item[key]);
	}
	return result;
}
