import './App.css'
import { createVirtualList } from '../src/create-virtual'
import { makeModels } from './models'


function App() {
	const models = makeModels();

	const virtual = createVirtualList({
		models: () => models,
		getElement: (item, index, ref) => {
			return <div class="virtualList__item" ref={ref}>{item.title}</div>
		},
		itemHeight: 30,
		renderBeyondFold: 300,
	});

	return (
		<div class="virtualList" ref={virtual.scrollElem}>
			<div class="virtualList__scroller" style={{ height: `${virtual.height()}px` }}>
				<div class="virtualList__items" style={{ 'top': virtual.itemsWrapperTop() + 'px', position: 'absolute', right: 0, left: 0 }}>
					
					{virtual.items()}
				</div>
			</div>
		</div>
	);
}

export default App
