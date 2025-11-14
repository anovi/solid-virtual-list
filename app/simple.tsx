import { createEffect, createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';

import { createVirtualList } from '../src/create-virtual'
import { makeModels, randomlyChangeModels } from './models'
import './App.css'
import { Head } from './Head';


export function Simple() {
	const [amout, setAmount] = createSignal(9999);
	const [models, setModels] = createStore(makeModels(amout()));
	const [changeInterval, setChangeInterval] = createSignal(200);
	let changeTimerID: number = -1;

	createEffect(() => {
		if (changeTimerID >= 0) clearInterval(changeTimerID);
		changeTimerID = randomlyChangeModels(models, setModels, changeInterval());
	});

	const Virtual = createVirtualList({
		models: () => models,
		itemComponent: (item, _index, ref) => {
			return <div class="virtualList__item" ref={ref}>{item.title}</div>
		},
		itemHeight: 30,
		renderBeyondFold: 100,
	});

	return (
		<>
		<Head />
		<div class="grid">
			<div class="grid__list">
				<Virtual.Root class="virtualList">
					<div class="virtualList__description">This is static content and not a&nbsp;rendered item.</div>
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
					<p>All items have fixed height. At specified interval, the title of a randomly chosen item is updated to display the current update count.</p>
					<h2>Usage</h2>
					<p>Create a virtual list:</p>
					<pre>
						<code>
							{code1}
						</code>
					</pre>
					<p>Then, insert its components:</p>
					<pre>
						<code>
							{code2}
						</code>
					</pre>
				</div>
			</div>
		</div>
		</>
	);
}


const code1 = `const Virtual = createVirtualList({
  models: () => models,
  getElement: (item, _index, ref) => {
    return <div ref={ref}>{item.title}</div>
  },
  itemHeight: 30,
  renderBeyondFold: 100,
});`;

const code2 = `<Virtual.Root>
  <p>This is static content and not a rendered item.</p>
  <Virtual.Content />
</Virtual.Root>`;
