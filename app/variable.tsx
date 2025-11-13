import { createEffect, createSignal, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';

import { createVirtualList } from '../src/create-virtual'
import { incrementalIndexGenerator, makeModels, randomIndexGenerator, randomlyChangeModels } from './models'
import './App.css'
import { Head } from './Head';


export function Variable() {
	const [amout, setAmount] = createSignal(100);
	const [models, setModels] = createStore(makeModels(amout()));
	const [changeInterval, setChangeInterval] = createSignal(200);
	let changeTimerID: number = -1;
	let scrollElem!: HTMLDivElement;

	createEffect(() => {
		if (changeTimerID >= 0) clearInterval(changeTimerID);
		changeTimerID = randomlyChangeModels(
			models,
			setModels,
			changeInterval(),
			incrementalIndexGenerator(models.length)
		);
	});

	onMount(() => {
		scrollElem.scroll({ top: 99999 })
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
				<Virtual.Root class="virtualList" ref={scrollElem}>
					<Virtual.Content />
				</Virtual.Root>
			</div>
			<div class="grid__controls">
				<div>There are <strong>{amout()}</strong> models.</div>
				<label for="speed">Change a random model every:</label><br />
				<input type="range" id="speed" name="speed" min="25" max="1000" value={changeInterval()} onInput={(e) => {
					const val = Number.parseInt(e.target.value);
					if (!Number.isNaN(val)) {
						setChangeInterval(val);
					}
				}} />
				<span>{changeInterval()} ms</span>
				<div>
					<p>Iitems have variable height. At specified interval, the title and description of a randomly chosen model is updated. So the resulting item height changes. The virtual list handles theese changes by making mesurements and asjusting scroll position.</p>
				</div>
			</div>
		</div>
		</>
	);
}
