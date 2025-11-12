export type Model = {
	title: string;
	description: string;	
}

export function makeModels() {
	const result: Model[] = [];
	for (let index = 0; index < 9999; index++) {
		result.push({
			title: `Item ${index}`,
			description: '',
		});
	}
	return result;
}
