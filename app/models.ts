import type { Accessor, Setter } from "solid-js";

export type Model = {
	id: string;
	title: string;
	description: string;	
	count: number;
}

const LOREM_IPSUM = `
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor. Cras elementum ultrices diam. Maecenas ligula massa, varius a, semper congue, euismod non, mi. Proin porttitor, orci nec nonummy molestie, enim est eleifend mi, non fermentum diam nisl sit amet erat. Duis semper. Duis arcu massa, scelerisque vitae, consequat in, pretium a, enim. Pellentesque congue. Ut in risus volutpat libero pharetra tempor. Cras vestibulum bibendum augue. Praesent egestas leo in pede. Praesent blandit odio eu enim. Pellentesque sed dui ut augue blandit sodales. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Aliquam nibh. Mauris ac mauris sed pede pellentesque fermentum. Maecenas adipiscing ante non diam sodales hendrerit.
`;

function getRandomDescription(): string {
	const sentences = LOREM_IPSUM
		.replace(/\n/g, " ")
		.split(". ")
		.map(s => s.trim())
		.filter(Boolean)
		.map(s => s.endsWith('.') ? s : s + '.');
	const count = Math.floor(Math.random() * 5) + 1; // 1 to 5 sentences
	const shuffled = sentences
		.map(value => ({ value, sort: Math.random() }))
		.sort((a, b) => a.sort - b.sort)
		.map(({ value }) => value);
	return shuffled.slice(0, count).join(" ");
}

export function makeModels(amount = 9999) {
	const result: Model[] = [];
	for (let index = 0; index < amount; index++) {
		result.push({
			id: String(index),
			title: `Item ${index}`,
			description: getRandomDescription(),
			count: 0,
		});
	}
	return result;
}

export function randomlyChangeModels(
	get: Accessor<Model[]>,
	set: Setter<Model[]>,
	intervalMs: number,
	indexGenerator?: Generator<number>
): number {
	const length = get().length;
	// Default to random generator if not provided
	const generator = indexGenerator ?? randomIndexGenerator(length);
	return setInterval(() => {
		const { value: index } = generator.next();
		// @ts-ignore
		// set(index, (model: Model) => ({
		// 	description: getRandomDescription(),
		// 	title: `Item ${index} changed ${model.count + 1}`,
		// 	count: model.count + 1
		// }));
		const model = get()[index];
		set([
			...get().slice(0, index),
			{
				...model,
				description: getRandomDescription(),
				title: `Item ${index} changed ${model.count + 1}`,
				count: model.count + 1
			},
			...get().slice(index + 1),
		])
	}, intervalMs);
}

/** Yields random indices in [0, length-1] forever */
export function* randomIndexGenerator(length: number): Generator<number> {
	while (true) {
		yield Math.floor(Math.random() * length);
	}
}

/** Yields indices 0,1,2,...,length-1,0,1,... forever */
export function* incrementalIndexGenerator(length: number): Generator<number> {
	let i = 0;
	while (true) {
		yield i;
		i = (i + 1) % length;
	}
}
