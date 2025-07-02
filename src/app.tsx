import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { onMount, Suspense } from "solid-js";
import Nav from "~/components/Nav";
import "./app.css";
import { initFileHosts } from "./classes/file-host";

export default function App() {
	onMount(async () => {
		// Initialize any stored file hosts
		await initFileHosts();
	});

	return (
		<Router
			root={(props) => (
				<div class="flex w-[100vw] h-[100vh]">
					<Nav />
					<Suspense>{props.children}</Suspense>
				</div>
			)}
		>
			<FileRoutes />
		</Router>
	);
}
