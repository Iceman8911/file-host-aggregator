import HardDriveIcon from "lucide-solid/icons/hard-drive";
import { Show } from "solid-js";
import { FileHost } from "~/classes/file-host";

export default function Home() {
	const fileHostMap = FileHost.collection;
	const fileHostMapSize = fileHostMap.size;

	return (
		<main class="text-center mx-auto p-4 flex">
			<Show when={fileHostMapSize} fallback={CreateFileHostComponent()}>
				Test
			</Show>
		</main>
	);
}

function CreateFileHostComponent() {
	return (
		<div class="m-auto">
			<HardDriveIcon class="m-auto size-35" />
			<div class="text-xl">
				No file hosts detected.{" "}
				<button type="button" class="link link-primary">
					Create one to get started.
				</button>
			</div>
		</div>
	);
}
