import { createEffect, createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';

import { createVirtualList } from '../src/create-virtual'
import { makeModels, randomlyChangeModels } from './models'
import './App.css'
import { Head } from './Head';


export function Variable() {
	const [amout, setAmount] = createSignal(100);
	const [models, setModels] = createStore(makeModels(amout()));
	const [changeInterval, setChangeInterval] = createSignal(200);
	let changeTimerID: number = -1;

	createEffect(() => {
		if (changeTimerID >= 0) clearInterval(changeTimerID);
		changeTimerID = randomlyChangeModels(models, setModels, changeInterval());
	});

	const Virtual = createVirtualList({
		models: () => models,
		getElement: (item, _index, ref) => {
			return <div class="virtualList__item" ref={ref}>
				<div class="virtualList__itemTitle">{item.title}</div>
				<div class="virtualList__itemDescription">{item.description}</div>				
			</div>
		},
		expectedItemHeight: 100,
		renderBeyondFold: 100,
	});

	return (
		<>
		<Head />
		<div class="grid">
			<div class="grid__list">
				<Virtual.Root class="virtualList">
					Some content inside virtual list container
					<Virtual.Content />
				</Virtual.Root>
			</div>
			<div class="grid__controls">
				<div>There are <strong>{amout()}</strong> models.</div>
				<label for="speed">Randomly change models every:</label><br />
				<input type="range" id="speed" name="speed" min="25" max="1000" value={changeInterval()} onInput={(e) => {
					const val = Number.parseInt(e.target.value);
					if (!Number.isNaN(val)) {
						setChangeInterval(val);
					}
				}} />
				<span>{changeInterval()} ms</span>
			</div>
		</div>
		</>
	);
}
