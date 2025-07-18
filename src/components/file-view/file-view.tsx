import { hfs } from "@humanfs/web";
import { trackStore } from "@solid-primitives/deep";
import { createAsync } from "@solidjs/router";
import { parse, stringify } from "@worker-tools/structured-json";
import { createEffect, createMemo, on, onMount, Show } from "solid-js";
import { createStore, produce, unwrap } from "solid-js/store";
import { FileHost } from "~/classes/file-host";
import { FileHostFile } from "~/classes/file-host-file";
import { ROOT_PATH } from "~/shared/constants";
import type {
	FileOrDirectory,
	FileOrDirectoryOrFileHost,
} from "~/types/file-directory-file-host/file-directory-file-host";
import type {
	FileHostID,
	FileHostImplementations,
} from "~/types/file-directory-file-host/file-host";
import type {
	FilesOrDirectoriesOrFileHosts,
	FileView_Settings,
} from "~/types/file-view";
import type { AbsoluteDirectoryPath } from "~/types/path";
import { quickSort } from "~/utils/async-quick-sort";
import { isDirectory } from "~/utils/file-directory-file-host/directory";
import { isFileHostFile } from "~/utils/file-directory-file-host/file";
import { isFileHost } from "~/utils/file-directory-file-host/file-host";
import { generateUUID } from "~/utils/other";
import FileDetails from "../modal/file-details";
import { showModal } from "../modal/modal";
import { FileView_DirectoryPathBar } from "./directory-path-bar";
import { FileView_ListOfFilesAndFoldersAndFileHosts } from "./list-of-files-and-directories-and-file-hosts";
import { FileView_OptionsDropdownBtn } from "./option-dropdown-btn";
import { FileView_UtilityIcons } from "./utility-icons";

type SerializableFilePathTracker = FileView_Settings["pathData"] & {
	fileHost: FileHostID | null;
};

type SerializableFileViewSettings = FileView_Settings & {
	pathData: SerializableFilePathTracker;
};

const FILE_VIEW_SETTINGS_SAVE_PATH = "settings/file-view-settings.json";

const defaultFileViewSettings: Readonly<FileView_Settings> = {
	iconSize: "M",
	isRefreshing: false,
	mode: "list",
	pathData: { fileHost: null, relativePath: ROOT_PATH },
	// Sort alpabetically by default
	sorting: { order: "asc", param: "name" },
};

const [fileViewSettings, setFileViewSettings] = createStore<FileView_Settings>(
	defaultFileViewSettings,
);

type FileDetailsDialogData = {
	data: FileOrDirectoryOrFileHost | null;
	modalId: string;
};

const [fileDetailsDialogData, setFileDetailsDialogData] =
	createStore<FileDetailsDialogData>({ data: null, modalId: generateUUID() });

export const FileView_Shared = {
	/** This is the place that all the created file host will be displayed */
	handleNavigateToFileHostsView() {
		setFileViewSettings(
			produce((state) => {
				state.pathData.fileHost = null;
			}),
		);
	},

	/** This the the root path in a selected file host.
	 *
	 * It assumes that a file host has previously been selected */
	handleNavigateToFileHostRoot() {
		setFileViewSettings(
			produce((state) => {
				state.pathData.relativePath = ROOT_PATH;
			}),
		);
	},

	/** What controls when a file or directory or file host is opened */
	handleOpenFileOrDirectoryOrFileHost(data: FileOrDirectoryOrFileHost) {
		setFileViewSettings(
			produce((state) => {
				if (data instanceof FileHost) {
					state.pathData.fileHost = data;
					state.pathData.relativePath = ROOT_PATH;
				} else if (!(data instanceof FileHostFile)) {
					state.pathData.relativePath = [
						state.pathData.relativePath,
						data.name,
					].flat();
				}
			}),
		);
	},

	/** Displays the details of a file or directory or file host */
	handleShowFileOrDirectoryOrFileHostDetails(data: FileOrDirectoryOrFileHost) {
		setFileDetailsDialogData(
			produce((state) => {
				state.data = data;
			}),
		);
		showModal(fileDetailsDialogData.modalId);
	},
};

export default function FileView() {
	const fileHostArray = () => Array.from(FileHost.collection.values());

	// Loading up the file hosts' root would take roughly 600ms ~ 3000ms per host so it'll be best to cache it beforehand
	onMount(async () => {
		const cacheFileHostRootContents = async () => {
			const promises = fileHostArray().map((host) =>
				host.getDirContents(
					[host.root(), ROOT_PATH].flat() as AbsoluteDirectoryPath,
				),
			);

			return await Promise.all(promises);
		};

		await cacheFileHostRootContents();
	});

	async function serializeAndSaveFileViewSettings() {
		const clone = { ...unwrap(fileViewSettings) };
		const serializableClone: SerializableFileViewSettings = {
			...clone,
			isRefreshing: false,
			pathData: {
				...clone.pathData,
				fileHost: clone.pathData.fileHost?.id ?? null,
			} as SerializableFilePathTracker,
		};

		await hfs.write(FILE_VIEW_SETTINGS_SAVE_PATH, stringify(serializableClone));
		return serializableClone;
	}

	async function deserializeFileViewSettings() {
		const fileContent = await hfs.text(FILE_VIEW_SETTINGS_SAVE_PATH);
		if (!fileContent) return;

		const parsedSettings: SerializableFileViewSettings = parse(fileContent);

		// Convert the fileHost ID to the actual FileHost instance
		const fileHost =
			parsedSettings.pathData.fileHost !== null
				? (FileHost.collection.get(parsedSettings.pathData.fileHost) ?? null)
				: null;

		const settingsToRestore: FileView_Settings = {
			...parsedSettings,
			pathData: {
				...parsedSettings.pathData,
				fileHost,
				relativePath: parsedSettings.pathData.relativePath,
			},
		};

		setFileViewSettings(settingsToRestore);

		return settingsToRestore;
	}

	// Retrieve the file view settings from the OPFS
	onMount(async () => {
		await deserializeFileViewSettings();
	});

	// For saving changes to the file view settings
	createEffect(
		on(
			// To track all changes in the store
			() => trackStore(fileViewSettings),
			() => {
				serializeAndSaveFileViewSettings();
			},
		),
	);

	const _fetchedFilesOrFileHosts = createMemo<
		Promise<FilesOrDirectoriesOrFileHosts>
	>(() => {
		const fileHost = () => fileViewSettings.pathData.fileHost;
		const relativePath = () => fileViewSettings.pathData.relativePath;

		if (fileHost()) {
			// Workaround for typescript to know that the function call isn't null
			const fileHostVar = fileHost() as FileHostImplementations;

			return fileHostVar.getDirContents(
				[fileHostVar.root(), relativePath()].flat() as AbsoluteDirectoryPath,
			);
		}

		return Promise.resolve(fileHostArray());
	});

	const sortingData = () => fileViewSettings.sorting;
	const sortingOrder = () => sortingData().order;
	const sortingParam = () => sortingData().param;

	/** stuff like sorting */
	const _processedFilesOrFileHosts = createMemo<
		Promise<FilesOrDirectoriesOrFileHosts>
	>(
		on(
			// Since the memo is async, explicitly pass the dependencies so reactivity isn't lost
			[
				async () => await _fetchedFilesOrFileHosts(),
				sortingOrder,
				sortingParam,
			],

			async () => {
				const originalFilesOrFileHosts = await _fetchedFilesOrFileHosts();

				if (!originalFilesOrFileHosts) return [];

				//@ts-expect-error Yeah, I messed up the types, but it works :D
				const sorted: FilesOrDirectoriesOrFileHosts = await quickSort<
					FileOrDirectory | FileHostImplementations
				>(originalFilesOrFileHosts, async (a, b) => {
					switch (sortingParam()) {
						case "name": {
							const nameOfA =
								isFileHost(a) || isDirectory(a) ? a.name : a.metadata.name;

							const nameOfB =
								isFileHost(b) || isDirectory(b) ? b.name : b.metadata.name;

							return (
								sortingOrder() === "asc"
									? nameOfA >= nameOfB
									: nameOfA <= nameOfB
							)
								? 1
								: -1;
						}

						case "date": {
							const dateOfA = isFileHost(a)
								? a.dateCreated.getTime()
								: isFileHostFile(a)
									? a.metadata.dateCreated.getTime()
									: a.dateEdited.getTime();

							const dateOfB = isFileHost(b)
								? b.dateCreated.getTime()
								: isFileHostFile(b)
									? b.metadata.dateCreated.getTime()
									: b.dateEdited.getTime();

							return (
								sortingOrder() === "asc"
									? dateOfA >= dateOfB
									: dateOfA <= dateOfB
							)
								? 1
								: -1;
						}

						case "size": {
							const sizeOfA = isFileHost(a)
								? await a.spaceUsed()
								: isFileHostFile(a)
									? a.metadata.size
									: a.size;

							const sizeOfB = isFileHost(b)
								? b.dateCreated.getTime()
								: isFileHostFile(b)
									? b.metadata.size
									: b.size;

							return (
								sortingOrder() === "asc"
									? sizeOfA >= sizeOfB
									: sizeOfA <= sizeOfB
							)
								? 1
								: -1;
						}

						// TODO:
						case "type":
							return 0;

						default:
							return 0;
					}
				});

				/** Destructured to ensure that the sorted array has a new reference and the UI changes
				 *
				 * This prolly happens since the array of files/directories/file hosts is cached and reused if the viewed directory doesn't change
				 */
				const result = [...(sorted ?? [])] as FilesOrDirectoriesOrFileHosts;

				return result;
			},
		),
	);

	const displayedFilesOrFileHosts = createAsync(() =>
		_processedFilesOrFileHosts(),
	);

	return (
		<>
			<div class="grid grid-cols-[1fr_32.5%] sm:grid-cols-[1fr_20%] grid-rows-[2.5rem_1fr] gap-4 p-2 size-full *:bg-base-200 *:rounded-field *:w-full">
				{/* Breadcrumbs bar */}
				<FileView_DirectoryPathBar
					pathData={fileViewSettings.pathData}
					setter={setFileViewSettings}
				/>

				{/* Utility icons */}
				<FileView_UtilityIcons
					settings={fileViewSettings}
					settingsSetter={setFileViewSettings}
				/>

				{/* Folder/File view */}
				<FileView_ListOfFilesAndFoldersAndFileHosts
					list={displayedFilesOrFileHosts.latest}
					settings={fileViewSettings}
					settingsSetter={setFileViewSettings}
				/>
			</div>

			{/* Option Dropdown Btn */}
			<FileView_OptionsDropdownBtn
				settings={fileViewSettings}
				settingsSetter={setFileViewSettings}
			/>

			{/* Dialogs */}
			<Show when={fileDetailsDialogData.data}>
				{(data) => (
					<FileDetails
						file={data()}
						modalId={fileDetailsDialogData.modalId}
					></FileDetails>
				)}
			</Show>
		</>
	);
}
