import { createStore } from 'solid-js/store';

import { createVirtualList } from '../src/create-virtual'
import { makeModels, randomlyChangeModels } from './models'
import './App.css'


function App() {
	const [models, setModels] = createStore(makeModels(9999));

	randomlyChangeModels(models, setModels, 20);

	const Virtual = createVirtualList({
		models: () => models,
		getElement: (item, _index, ref) => {
			return <div class="virtualList__item" ref={ref}>{item.title}</div>
		},
		itemHeight: 30,
		renderBeyondFold: 100,
	});

	return (
		<Virtual.Root class="virtualList">
			Some content inside virtual list container
			<Virtual.Content />
		</Virtual.Root>
	);
}

export default App;
