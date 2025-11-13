import { A } from "@solidjs/router";

export function Head() {
	return <div class="head">
		<nav>
			<A href='/'>Simple</A>
			<A href='/variable'>Variable height</A>
		</nav>
	</div>
}
