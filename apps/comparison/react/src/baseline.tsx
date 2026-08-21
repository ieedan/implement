import { useState } from "react";
import { createRoot } from "react-dom/client";

function Baseline() {
	const [count, setCount] = useState(0);

	return (
		<div className="app">
			<h1>Baseline</h1>
			<p>count: {count}</p>
			<button onClick={() => setCount((value) => value + 1)}>increment</button>
		</div>
	);
}

createRoot(document.getElementById("root")!).render(<Baseline />);

performance.mark("app-mounted");
