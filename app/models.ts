import type { Setter } from "solid-js";

export type Model = {
	title: string;
	description: string;	
	count: number;
}

export function makeModels(amount = 9999) {
	const result: Model[] = [];
	for (let index = 0; index < amount; index++) {
		result.push({
			title: `Item ${index}`,
			description: '',
			count: 0,
		});
	}
	return result;
}

export function randomlyChangeModels(get: Model[], set: Setter<Model[]>, intervalMs: number): void {
	setInterval(() => {
		const index = Math.round(Math.random() * (get.length - 1));
		// @ts-ignore
		set(index, (model: Model) => ({
			...model,
			title: `Item ${index} changed ${model.count + 1}`,
			count: model.count + 1
		}));
	}, intervalMs);
}
