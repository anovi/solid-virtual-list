import { Route, Router } from "@solidjs/router";

import './App.css'
import { Simple } from './simple';
import { Variable } from './variable';


function App() {
	return (
		<Router>
            <Route path="/" component={Simple} />
            <Route path="/variable" component={Variable} />
        </Router>
	);
}

export default App;
