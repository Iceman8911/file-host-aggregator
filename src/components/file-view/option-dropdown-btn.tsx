import OthersIcon from "lucide-solid/icons/ellipsis-vertical";
import FileCogIcon from "lucide-solid/icons/file-cog";
import UploadFileIcon from "lucide-solid/icons/file-up";
import CreateFolderIcon from "lucide-solid/icons/folder-plus";
import UploadFolderIcon from "lucide-solid/icons/folder-up";
import HardDriveIcon from "lucide-solid/icons/hard-drive";
import { type JSX, Show } from "solid-js";
import { produce, type SetStoreFunction } from "solid-js/store";
import type { FileView_Settings } from "~/types/file-view";
import { generateUUID } from "~/utils/other";
import CreateFileHostModal from "../modal/create-file-host";
import { showModal } from "../modal/modal";
import UploadFileModal from "../modal/upload-file";
import { FileView_SettingsModal } from "./settings-modal";

/** For exposing other actions like creating file hosts / uploading files */
export function FileView_OptionsDropdownBtn(prop: {
	settings: FileView_Settings;
	settingsSetter: SetStoreFunction<FileView_Settings>;
}) {
	function Dropdown(prop: {
		btn: JSX.Element;
		/** A list of options, excluding the `<ul>` tags */
		children: JSX.Element;
	}) {
		return (
			<div class="dropdown dropdown-left dropdown-end absolute bottom-8 right-12 md:bottom-10 md:right-14 [position-area:start]">
				{/* biome-ignore lint/a11y: Bug with safari makes buttons unfocusable :( */}
				<div tabindex="0" role="button" class="">
					{prop.btn}
				</div>

				<ul
					tabindex="0"
					class="dropdown-content menu bg-base-100 rounded-box z-1 w-max p-2 shadow-sm mr-4 border border-secondary font-semibold [&_button]:text-center"
				>
					{prop.children}
				</ul>
			</div>
		);
	}

	const createFileHostModalId = generateUUID();
	const fileViewSettingsModalId = generateUUID();
	const uploadFileModalId = generateUUID();

	function FileHostSpecificOptions() {
		return (
			<li>
				<button type="button" onClick={(_) => showModal(createFileHostModalId)}>
					<HardDriveIcon />
					Create File Host
				</button>
			</li>
		);
	}

	function NonFileHostSpecificOptions() {
		const handleNavigateToFileHostsView = () =>
			prop.settingsSetter(
				produce((state) => {
					state.pathData.fileHost = null;
				}),
			);
		return (
			<>
				<li>
					<button type="button" onClick={handleNavigateToFileHostsView}>
						<HardDriveIcon />
						Back To File Hosts
					</button>
				</li>

				<li>
					<button type="button" onClick={(_) => showModal(uploadFileModalId)}>
						<UploadFileIcon />
						Upload File
					</button>
				</li>

				<li>
					<button type="button">
						<UploadFolderIcon />
						Upload Folder
					</button>
				</li>

				<li>
					<button type="button">
						<CreateFolderIcon />
						Create Folder
					</button>
				</li>
			</>
		);
	}

	/** So I can optionally hide / show some stuff when it makes sense  */
	const isViewingFileHostOnlyArea = () => !prop.settings.pathData.fileHost;

	return (
		<>
			<Dropdown
				btn={
					<button
						type="button"
						class="size-16 btn btn-secondary btn-circle opacity-85"
						title="Other Actions"
					>
						<OthersIcon />
					</button>
				}
			>
				<Show
					when={!isViewingFileHostOnlyArea()}
					fallback={<FileHostSpecificOptions />}
				>
					<NonFileHostSpecificOptions />
				</Show>

				<li>
					<button
						type="button"
						onClick={(_) => showModal(fileViewSettingsModalId)}
					>
						<FileCogIcon />
						View Settings
					</button>
				</li>
			</Dropdown>

			{/* Dialogs */}
			<CreateFileHostModal modalId={createFileHostModalId} />
			<FileView_SettingsModal
				modalId={fileViewSettingsModalId}
				setSettings={prop.settingsSetter}
				settings={prop.settings}
			/>
			<UploadFileModal
				modalId={uploadFileModalId}
				defaultDirectory={
					prop.settings.pathData.fileHost?.getAbsolutePathFromRelativePath(
						prop.settings.pathData.relativePath,
					) ?? null
				}
			/>
		</>
	);
}
