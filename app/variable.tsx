import { createEffect, createReaction, createRenderEffect, createSignal, onMount, untrack, useTransition } from 'solid-js';

import { createVirtualList } from '../src/create-virtual'
import { incrementalIndexGenerator, makeModels, randomlyChangeModels, updateModel } from './models'
import './App.css'
import { Head } from './Head';



export function Variable() {
	const [amout, setAmount] = createSignal(15);
	const [models, setModels] = createSignal(makeModels(amout()));
	const [changeInterval, setChangeInterval] = createSignal(1000);
	let changeTimerID: number = -1;
	let scrollElem!: HTMLDivElement;

	createEffect(() => {
		if (changeTimerID >= 0) clearInterval(changeTimerID);
		changeTimerID = randomlyChangeModels(
			models,
			setModels,
			changeInterval(),
			incrementalIndexGenerator(untrack(() => models().length))
		);
	});

	function onButtonClick() {
		console.log('🧲 Change model')
		updateModel(models, setModels, 0, 'fuck super')
	}

	const Virtual = createVirtualList({
		models: models,
		itemComponent: (item, _index, ref) => {
			const [updated, setUpdateAnimation] = createSignal(false);

			const reactToModelChange = createReaction(() => {
				setUpdateAnimation(true);
				createDelay().then(() => setUpdateAnimation(false));
				reactToModelChange(() => item.title);
			});

			onMount(() => {
				reactToModelChange(() => item.title);
			});

			return <div class="virtualList__item" ref={ref} classList={{ "virtualList__item--updated": updated() }}>
				<div class="virtualList__itemTitle">{item.title}</div>
				<div class="virtualList__itemDescription">{item.description}</div>				
			</div>
		},
		expectedItemHeight: 150,
		renderBeyondFold: 400,
	});

	onMount(() => {
		setTimeout(() => {
			// console.log('💜 Scroll')
			// scrollElem.scroll({ top: 99000 })
		}, 50);
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
				<div><button onclick={onButtonClick}>Change model</button></div>
			</div>
		</div>
		</>
	);
}

function createDelay(delay = 2000) {
	return new Promise((resolve) => {
		setTimeout(() => resolve(delay), delay);
	});
}
