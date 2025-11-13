import './App.css'
import { createVirtualList } from '../src/create-virtual'
import { makeModels } from './models'


function App() {
	const models = makeModels();
	const Virtual = createVirtualList({
		models: () => models,
		getElement: (item, _index, ref) => {
			return <div class="virtualList__item" ref={ref}>{item.title}</div>
		},
		itemHeight: 30,
		renderBeyondFold: 100,
	});

	return (
		<Virtual.Root class="virtualList" >
			Some content inside virtual list container
			<Virtual.Content />
		</Virtual.Root>
	);
}

export default App;
