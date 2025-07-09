import HardDriveIcon from "lucide-solid/icons/hard-drive";
import { Show } from "solid-js";
import { FileHost } from "~/classes/file-host";
import FileView from "~/components/file-view";
import CreateFileHostModal from "~/components/modal/create-file-host";
import { showModal } from "~/components/modal/modal";
import { generateUUID } from "~/declarations/functions";

export default function Home() {
	const fileHostMap = FileHost.collection;
	const fileHostMapSize = () => fileHostMap.size;

	return (
		<main class="p-2 lg:p-4 size-full flex">
			<Show when={fileHostMapSize()} fallback={CreateFileHostComponent()}>
				<FileView />
			</Show>
		</main>
	);
}

function CreateFileHostComponent() {
	const createFileHostModalId = generateUUID();

	return (
		<>
			<div class="m-auto">
				<HardDriveIcon class="m-auto size-35" />
				<div class="text-xl">
					No file hosts detected.{" "}
					<button
						type="button"
						class="link link-primary"
						onClick={(_) => {
							showModal(createFileHostModalId);
						}}
					>
						Create one to get started.
					</button>
				</div>
			</div>

			<CreateFileHostModal modalId={createFileHostModalId} />
		</>
	);
}
