import { hfs } from "@humanfs/web";
import { trackStore } from "@solid-primitives/deep";
import { createAsync } from "@solidjs/router";
import { parse, stringify } from "@worker-tools/structured-json";
import CloudIcon from "lucide-solid/icons/cloud";
import CopyIcon from "lucide-solid/icons/copy";
import DownloadIcon from "lucide-solid/icons/download";
import OthersIcon from "lucide-solid/icons/ellipsis-vertical";
import DefaultFileIcon from "lucide-solid/icons/file";
import ArchiveFileIcon from "lucide-solid/icons/file-archive";
import AudioFileIcon from "lucide-solid/icons/file-audio";
import FileCogIcon from "lucide-solid/icons/file-cog";
import ImageFileIcon from "lucide-solid/icons/file-image";
import UnknownFileIcon from "lucide-solid/icons/file-question-mark";
import TextFileIcon from "lucide-solid/icons/file-text";
import DocumentFileIcon from "lucide-solid/icons/file-type";
import UploadFileIcon from "lucide-solid/icons/file-up";
import VideoFileIcon from "lucide-solid/icons/file-video";
import DefaultFolderIcon from "lucide-solid/icons/folder";
import ClosedFolderIcon from "lucide-solid/icons/folder-closed";
import OpenedFolderIcon from "lucide-solid/icons/folder-open";
import CreateFolderIcon from "lucide-solid/icons/folder-plus";
import UploadFolderIcon from "lucide-solid/icons/folder-up";
import HardDriveIcon from "lucide-solid/icons/hard-drive";
import InfoIcon from "lucide-solid/icons/info";
import MoveIcon from "lucide-solid/icons/move-up-left";
import RefreshIcon from "lucide-solid/icons/refresh-ccw";
import SearchIcon from "lucide-solid/icons/search";
import TrashIcon from "lucide-solid/icons/trash-2";
import {
	createEffect,
	createMemo,
	For,
	type JSX,
	Match,
	on,
	onMount,
	Show,
	Suspense,
	Switch,
} from "solid-js";
import {
	createStore,
	produce,
	type SetStoreFunction,
	unwrap,
} from "solid-js/store";
import { Dynamic } from "solid-js/web";
import {
	FileHost,
	FileHostFile,
	type FileHostID,
	type FileHostImplementations,
	type FileOrDirectory,
	type FileOrDirectoryOrFileHost,
	FileType,
	gGetCommonPropsFromFileOrFileHostOrDirectory,
} from "~/classes/file-host";
import { quickSort } from "~/declarations/async-quick-sort";
import { generateUUID } from "~/declarations/functions";
import { gFileHostIcons } from "~/declarations/icons";
import type {
	AbsoluteDirectoryPath,
	RelativeDirectoryPath,
	UUID,
} from "~/declarations/types";
import { ROOT_PATH } from "~/declarations/variables";
import LoadingSpinner from "./loading-spinner";
import CustomContextMenu from "./menu/custom-context-menu";
import CreateFileHostModal from "./modal/create-file-host";
import FileDetails from "./modal/file-details";
import { GenericModal, showModal } from "./modal/modal";

type FilePathTracker = {
	/** If `null`, do not bother with the `path`. Assume that no file host has been selected */
	fileHost: FileHostImplementations | null;

	/** Path relative to the `root` of the fileHost.
	 *
	 * **Don't forget to combine both values, when using the path**
	 */
	relativePath: RelativeDirectoryPath;
};

/** I hate that I actually wrote this >~< */
type FilesOrDirectoriesOrFileHosts =
	| FileOrDirectory[]
	| FileHostImplementations[]
	| null;

type FileViewSettings = {
	iconSize: "XS" | "S" | "M" | "L" | "XL";
	/** How the icons / file buttons will be displayed */
	mode: "grid-1" | "grid-2" | "list" | "minimal" | "columned";
	/** This is used to determine what files / filehosts should be shown */
	pathData: FilePathTracker;
	/** Whether the file host(s) data is currently being refreshed */
	isRefreshing: boolean;
	/** How the files and folders should be sorted when displaying them */
	sorting: { param: "name" | "date" | "size" | "type"; order: "asc" | "desc" };
};

const defaultFileViewSettings: Readonly<FileViewSettings> = {
	iconSize: "M",
	isRefreshing: false,
	mode: "grid-1",
	pathData: { fileHost: null, relativePath: ROOT_PATH },
	// Sort alpabetically by default
	sorting: { order: "asc", param: "name" },
};

const [fileViewSettings, setFileViewSettings] = createStore<FileViewSettings>(
	defaultFileViewSettings,
);

type SerializableFilePathTracker = FilePathTracker & {
	fileHost: FileHostID | null;
};
type SerializableFileViewSettings = FileViewSettings & {
	pathData: SerializableFilePathTracker;
};
const FILE_VIEW_SETTINGS_SAVE_PATH = "settings/file-view-settings.json";

const serializeAndSaveFileViewSettings = async () => {
	const clone = { ...unwrap(fileViewSettings) };
	const serializableClone: SerializableFileViewSettings = {
		...clone,
		pathData: {
			...clone.pathData,
			fileHost: clone.pathData.fileHost?.id ?? null,
		} as SerializableFilePathTracker,
	};

	await hfs.write(FILE_VIEW_SETTINGS_SAVE_PATH, stringify(serializableClone));
	return serializableClone;
};

const deserializeFileViewSettings = async () => {
	const fileContent = await hfs.text(FILE_VIEW_SETTINGS_SAVE_PATH);
	if (!fileContent) return;

	const parsedSettings: SerializableFileViewSettings = parse(fileContent);

	// Convert the fileHost ID to the actual FileHost instance
	const fileHost =
		parsedSettings.pathData.fileHost !== null
			? (FileHost.collection.get(parsedSettings.pathData.fileHost) ?? null)
			: null;

	const settingsToRestore: FileViewSettings = {
		...parsedSettings,
		pathData: {
			...parsedSettings.pathData,
			fileHost,
			relativePath: parsedSettings.pathData.relativePath,
		},
	};

	setFileViewSettings(settingsToRestore);

	return settingsToRestore;
};

/** So I can optionally hide / show some stuff when it makes sense  */
const isViewingFileHostOnlyArea = () => !fileViewSettings.pathData.fileHost;

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
								a instanceof FileHost || !(a instanceof FileHostFile)
									? a.name
									: a.name(true);
							const nameOfB =
								b instanceof FileHost || !(b instanceof FileHostFile)
									? b.name
									: b.name(true);

							return (
								sortingOrder() === "asc"
									? nameOfA >= nameOfB
									: nameOfA <= nameOfB
							)
								? 1
								: -1;
						}
						case "date": {
							const dateOfA =
								a instanceof FileHost
									? a.dateCreated.getTime()
									: a instanceof FileHostFile
										? a.dateCreated.getTime()
										: a.dateEdited.getTime();
							const dateOfB =
								b instanceof FileHost
									? b.dateCreated.getTime()
									: b instanceof FileHostFile
										? b.dateCreated.getTime()
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
							const sizeOfA =
								a instanceof FileHost
									? await a.spaceUsed()
									: a instanceof FileHostFile
										? a.size
										: a.size;
							const sizeOfB =
								b instanceof FileHost
									? b.dateCreated.getTime()
									: b instanceof FileHostFile
										? b.size
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
				<DirectoryPathBar
					pathData={fileViewSettings.pathData}
					setter={setFileViewSettings}
				/>

				{/* Utility icons */}
				<UtilityIcons
					settings={fileViewSettings}
					settingsSetter={setFileViewSettings}
				/>

				{/* Folder/File view */}
				<ListOfFilesAndFoldersAndFileHosts
					list={displayedFilesOrFileHosts.latest}
					settingsSetter={setFileViewSettings}
				/>
			</div>

			{/* Option Dropdown Btn */}
			<OptionsDropdownBtn />
		</>
	);
}

const handleNavigateToFileHostsView = () => {
	setFileViewSettings(
		produce((state) => {
			state.pathData.fileHost = null;
		}),
	);
};

const handleNavigateToFileHostRoot = () => {
	setFileViewSettings(
		produce((state) => {
			state.pathData.relativePath = ROOT_PATH;
		}),
	);
};

/**
 *
 * @param pathIndex The index of the path to navigate to in the `relativePath` array.
 */
const handleNavigateToPath = (pathIndex: number) => {
	setFileViewSettings(
		produce((state) => {
			state.pathData.relativePath = state.pathData.relativePath.slice(
				0,
				pathIndex + 1,
			);
		}),
	);
};

function DirectoryPathBar(prop: {
	pathData: FilePathTracker;
	setter: SetStoreFunction<FileViewSettings>;
}) {
	return (
		<div class="breadcrumbs text-sm sm:text-[1.025rem] px-4 text-primary overflow-y-clip scrollbar-thin select-none">
			<ul class="*:last:font-bold">
				<li>
					<button type="button" onClick={handleNavigateToFileHostsView}>
						<CloudIcon />
						File Hosts
					</button>
				</li>

				<Show when={prop.pathData.fileHost}>
					{(fileHost) => {
						const relativePath = () => prop.pathData.relativePath;

						return (
							<>
								<li>
									<button type="button" onClick={handleNavigateToFileHostRoot}>
										<HardDriveIcon />
										{fileHost().name}
									</button>
								</li>

								<For each={relativePath()}>
									{(pathFragment, index) => (
										<li>
											<Show
												// Don't apply to the last list item
												when={relativePath().length - 1 !== index()}
												fallback={
													<div class="flex gap-2 place-items-center">
														<ClosedFolderIcon />
														{pathFragment}
													</div>
												}
											>
												<button
													type="button"
													onClick={() => handleNavigateToPath(index())}
												>
													<OpenedFolderIcon />
													{pathFragment}
												</button>
											</Show>
										</li>
									)}
								</For>
							</>
						);
					}}
				</Show>
			</ul>
		</div>
	);
}

function UtilityIcons(prop: {
	settings: FileViewSettings;
	settingsSetter: SetStoreFunction<FileViewSettings>;
}) {
	const settings = () => prop.settings;

	const handleRefreshFiles = async () => {
		if (settings().isRefreshing === true) return;

		prop.settingsSetter(
			produce(async (state) => {
				state.isRefreshing = true;

				// Refetch the data
				await state.pathData.fileHost?.downloadFiles();

				state.isRefreshing = false;
			}),
		);
	};

	return (
		<div class="flex gap-2 justify-center items-center *:btn *:btn-primary *:btn-soft *:btn-sm *:p-1 *:btn-circle">
			<button type="button">
				<SearchIcon />
			</button>{" "}
			<button
				type="button"
				disabled={isViewingFileHostOnlyArea()}
				onClick={handleRefreshFiles}
			>
				<Show when={settings().isRefreshing} fallback={<RefreshIcon />}>
					<span class="loading loading-spinner"></span>
				</Show>
			</button>
		</div>
	);
}

function ListOfFilesAndFoldersAndFileHosts(prop: {
	list: FilesOrDirectoriesOrFileHosts | undefined;
	settingsSetter: SetStoreFunction<FileViewSettings>;
}) {
	type FileDetailsDialogData = {
		data: FileOrDirectoryOrFileHost | null;
		modalId: string;
	};

	const [fileDetailsDialogData, setFileDetailsDialogData] =
		createStore<FileDetailsDialogData>({ data: null, modalId: generateUUID() });

	const handleOpenFileOrDirectoryOrFileHost = (
		val: FileOrDirectoryOrFileHost,
	) => {
		prop.settingsSetter(
			produce((state) => {
				if (val instanceof FileHost) {
					state.pathData.fileHost = val;
					state.pathData.relativePath = ROOT_PATH;
				} else if (!(val instanceof FileHostFile)) {
					state.pathData.relativePath = [
						state.pathData.relativePath,
						val.name,
					].flat();
				}
			}),
		);
	};

	const handleShowFileOrFolderOrFileHostDetails = (
		data: FileOrDirectoryOrFileHost,
	) => {
		setFileDetailsDialogData(
			produce((state) => {
				state.data = data;
			}),
		);
		showModal(fileDetailsDialogData.modalId);
	};

	function ContextMenu(prop: { data: FileOrDirectoryOrFileHost }) {
		function UniqueOptions() {
			return (
				<Switch>
					<Match
						when={
							(prop.data instanceof FileHost ||
								!(prop.data instanceof FileHostFile)) &&
							prop.data
						}
					>
						{(val) => (
							<li>
								<button
									type="button"
									onClick={() => handleOpenFileOrDirectoryOrFileHost(val())}
								>
									<Show
										when={val() instanceof FileHost}
										fallback={<OpenedFolderIcon />}
									>
										<HardDriveIcon />
									</Show>
									Open
								</button>
							</li>
						)}
					</Match>

					<Match when={prop.data instanceof FileHostFile && prop.data}>
						{(file) => {
							return (
								<li>
									<button type="button" onClick={(_) => file().getFile()}>
										<DefaultFileIcon />
										View
									</button>
								</li>
							);
						}}
					</Match>
				</Switch>
			);
		}

		return (
			<>
				<UniqueOptions />

				<li>
					<button type="button">
						<DownloadIcon />
						Download
					</button>
				</li>

				<li>
					<button type="button">
						<CopyIcon />
						Copy
					</button>
				</li>

				<li>
					<button type="button">
						<MoveIcon />
						Move
					</button>
				</li>

				<li>
					<button type="button" class="text-error">
						<TrashIcon />
						Delete
					</button>
				</li>

				<li>
					<button
						type="button"
						onClick={() => {
							handleShowFileOrFolderOrFileHostDetails(prop.data);
						}}
					>
						<InfoIcon />
						Details
					</button>
				</li>
			</>
		);
	}

	function Thumbnail(prop: { data: FileOrDirectoryOrFileHost }) {
		return (
			<Switch>
				<Match when={prop.data instanceof FileHost && prop.data}>
					{(val) => (
						<>
							<HardDriveIcon />
							<Dynamic
								component={gFileHostIcons[val().type]}
								class="absolute right-0 bottom-0 size-6 opacity-75"
							/>
						</>
					)}
				</Match>

				<Match
					when={
						!(prop.data instanceof FileHost) &&
						!(prop.data instanceof FileHostFile)
					}
				>
					<DefaultFolderIcon />
				</Match>

				<Match when={prop.data instanceof FileHostFile && prop.data}>
					{(file) => (
						<Switch fallback={<UnknownFileIcon />}>
							<Match when={file().type === FileType.ARCHIVE}>
								<ArchiveFileIcon />
							</Match>

							<Match when={file().type === FileType.AUDIO}>
								<AudioFileIcon />
							</Match>

							<Match when={file().type === FileType.DOCUMENT}>
								<DocumentFileIcon />
							</Match>

							<Match when={file().type === FileType.IMAGE}>
								<ImageFileIcon />
							</Match>

							<Match when={file().type === FileType.TEXT}>
								<TextFileIcon />
							</Match>

							<Match when={file().type === FileType.VIDEO}>
								<VideoFileIcon />
							</Match>
						</Switch>
					)}
				</Match>
			</Switch>
		);
	}

	function SpaceUsedPercentageRadialBar(prop: {
		data: FileOrDirectoryOrFileHost;
	}) {
		return (
			<Show when={prop.data instanceof FileHost && prop.data}>
				{(val) => {
					const resolvedValues = createAsync(async () => {
						return {
							spaceUsed: await val().spaceUsed(),
							spaceTotal: await val().spaceTotal(),
						};
					});

					return (
						<Suspense fallback={<LoadingSpinner />}>
							<Show when={resolvedValues()}>
								{(val) => {
									const percentageUsed = (
										(val().spaceUsed / val().spaceTotal) *
										100
									).toFixed(2);

									return (
										<div
											// When the parent button is hover over, the radial bar will change color to still be legible
											class="radial-progress text-secondary mt-0.5 group-hover:text-secondary-content"
											style={`--value:${percentageUsed};`}
											aria-valuenow={percentageUsed}
											role="progressbar"
										>
											{percentageUsed}%
										</div>
									);
								}}
							</Show>
						</Suspense>
					);
				}}
			</Show>
		);
	}

	function Grid1View() {
		return (
			<div class="col-[1_/_3] flex flex-wrap place-content-start gap-4 md:gap-8 p-4 select-none overflow-y-auto">
				<Suspense fallback={<LoadingSpinner />}>
					<For each={prop.list}>
						{(val) => {
							const name =
								gGetCommonPropsFromFileOrFileHostOrDirectory(val).name;

							return (
								<CustomContextMenu
									closeOnClick={true}
									contextMenu={<ContextMenu data={val} />}
								>
									<button
										type="button"
										class="relative group flex flex-col justify-center items-center w-22 md:w-27 lg:w-30 h-fit aspect-square btn btn-primary btn-soft text-xs sm:text-sm"
										title={name}
										onClick={() => handleOpenFileOrDirectoryOrFileHost(val)}
									>
										<div class="relative size-fit *:first:size-16">
											<Thumbnail data={val} />
										</div>

										<p class="font-bold overflow-clip text-ellipsis whitespace-nowrap w-full">
											{name}
										</p>

										<SpaceUsedPercentageRadialBar data={val} />
									</button>
								</CustomContextMenu>
							);
						}}
					</For>
				</Suspense>
			</div>
		);
	}

	function Grid2View() {
		return (
			<div class="col-[1_/_3] flex flex-wrap place-content-start gap-4 md:gap-8 p-4 select-none overflow-y-auto">
				<Suspense fallback={<LoadingSpinner />}>
					<For each={prop.list}>
						{(val) => {
							const name =
								gGetCommonPropsFromFileOrFileHostOrDirectory(val).name;

							return (
								<CustomContextMenu
									closeOnClick={true}
									contextMenu={<ContextMenu data={val} />}
								>
									<button
										type="button"
										class="relative group flex flex-col justify-center items-center w-22 md:w-27 lg:w-30 h-fit aspect-square btn btn-primary btn-soft text-xs sm:text-sm"
										title={name}
										onClick={() => handleOpenFileOrDirectoryOrFileHost(val)}
									>
										<div class="relative size-fit *:first:size-16">
											<Thumbnail data={val} />
										</div>

										<p class="font-bold [word-break:auto-phrase] h-16 overflow-hidden text-ellipsis w-full">
											{name}
										</p>

										<SpaceUsedPercentageRadialBar data={val} />
									</button>
								</CustomContextMenu>
							);
						}}
					</For>
				</Suspense>
			</div>
		);
	}

	function ListView() {
		return (
			<div class="col-[1_/_3] grid grid-cols-1 auto-rows-[4.5rem] gap-2 md:gap-4 p-4 select-none overflow-y-auto">
				<Suspense fallback={<LoadingSpinner />}>
					<For each={prop.list}>
						{(val) => {
							const data = gGetCommonPropsFromFileOrFileHostOrDirectory(val);

							const name = data.name;
							const date = data.dateCreated.toUTCString();
							const size = createAsync(() => Promise.resolve(data.size));

							return (
								<CustomContextMenu
									closeOnClick={true}
									contextMenu={<ContextMenu data={val} />}
								>
									<button
										type="button"
										class="relative group px-2 grid grid-cols-[20%_42.5%_35%] sm:grid-cols-[15%_47.5%_35%] grid-rows-[1.5fr_1fr] items-center size-full aspect-square btn btn-primary btn-soft"
										title={name}
										onClick={() => handleOpenFileOrDirectoryOrFileHost(val)}
									>
										<div class="relative size-fit row-span-2 *:first:size-12 md:*:first:size-16">
											<Thumbnail data={val} />
										</div>

										<p class="col-[2/4] text-left sm:text-lg font-bold overflow-clip text-ellipsis whitespace-nowrap w-full">
											{name}
										</p>

										<p class="row-[2/3] col-[2/3] text-left text-sm overflow-clip text-ellipsis whitespace-nowrap w-full">
											<Suspense fallback={<LoadingSpinner />}>
												{size.latest?.parsed}
											</Suspense>
										</p>

										<p class="row-[2/3] col-[3/4] text-right text-sm overflow-clip text-ellipsis whitespace-nowrap w-full">
											{date}
										</p>
									</button>
								</CustomContextMenu>
							);
						}}
					</For>
				</Suspense>
			</div>
		);
	}

	function MinimalView() {
		return (
			<div class="col-[1_/_3] flex flex-wrap place-content-start gap-4 md:gap-8 p-4 select-none overflow-y-auto">
				<Suspense fallback={<LoadingSpinner />}>
					<For each={prop.list}>
						{(val) => {
							const data = gGetCommonPropsFromFileOrFileHostOrDirectory(val);
							const name = data.name;

							return (
								<CustomContextMenu
									closeOnClick={true}
									contextMenu={<ContextMenu data={val} />}
								>
									<button
										type="button"
										class="relative group flex flex-col justify-center items-center w-30 lg:w-35 h-fit aspect-video btn btn-ghost text-primary p-0 text-sm"
										title={name}
										onClick={() => handleOpenFileOrDirectoryOrFileHost(val)}
									>
										<p class="font-bold overflow-clip text-ellipsis [word-break:auto-phrase] size-full">
											{name}
										</p>
									</button>
								</CustomContextMenu>
							);
						}}
					</For>
				</Suspense>
			</div>
		);
	}

	function ColumnedView() {
		return (
			<div class="col-[1_/_3] grid grid-cols-1 auto-rows-[4.5rem] gap-2 md:gap-4 p-4 select-none overflow-y-auto">
				<Suspense fallback={<LoadingSpinner />}>
					<For each={prop.list}>
						{(val) => {
							const data = gGetCommonPropsFromFileOrFileHostOrDirectory(val);

							const name = data.name;
							const date = data.dateCreated.toUTCString();
							const size = createAsync(() => Promise.resolve(data.size));

							return (
								<CustomContextMenu
									closeOnClick={true}
									contextMenu={<ContextMenu data={val} />}
								>
									<button
										type="button"
										class="relative group px-2 grid grid-cols-[15%_42.5%_15%_25%] items-center size-full aspect-square btn btn-primary btn-soft md:text-lg"
										title={name}
										onClick={() => handleOpenFileOrDirectoryOrFileHost(val)}
									>
										<div class="relative size-fit *:first:size-12 md:*:first:size-16">
											<Thumbnail data={val} />
										</div>

										<p class="text-left text-sm font-bold overflow-clip text-ellipsis whitespace-nowrap w-full">
											{name}
										</p>

										<p class="text-left text-sm overflow-clip text-ellipsis whitespace-nowrap w-full">
											<Suspense fallback={<LoadingSpinner />}>
												{size.latest?.parsed}
											</Suspense>
										</p>

										<p class="text-right text-sm overflow-clip text-ellipsis whitespace-nowrap w-full">
											{date}
										</p>
									</button>
								</CustomContextMenu>
							);
						}}
					</For>
				</Suspense>
			</div>
		);
	}

	return (
		<>
			<Switch>
				<Match when={fileViewSettings.mode === "grid-1"}>
					<Grid1View />
				</Match>

				<Match when={fileViewSettings.mode === "grid-2"}>
					<Grid2View />
				</Match>

				<Match when={fileViewSettings.mode === "list"}>
					<ListView />
				</Match>

				<Match when={fileViewSettings.mode === "minimal"}>
					<MinimalView />
				</Match>

				<Match when={fileViewSettings.mode === "columned"}>
					<ColumnedView />
				</Match>
			</Switch>

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

/** For exposing other actions like creating file hosts / uploading files */
function OptionsDropdownBtn() {
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
		return (
			<>
				<li>
					<button type="button" onClick={handleNavigateToFileHostsView}>
						<HardDriveIcon />
						Back To File Hosts
					</button>
				</li>

				<li>
					<button type="button">
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
			<FileViewSettingsModal modalId={fileViewSettingsModalId} />
		</>
	);
}

function FileViewSettingsModal(prop: { modalId: string }) {
	const displayModeRadioBtnName = "file-view-display-mode";
	const sortParamRadioBtnName = "file-view-sort-param";
	const sortDirectionRadioBtnName = "file-view-sort-direction";

	function DisplayModeRadioBtns() {
		const options = [
			{ name: "Grid-1", value: "grid-1" },
			{ name: "Grid-2", value: "grid-2" },
			{ name: "List", value: "list" },
			{ name: "Columned", value: "columned" },
			{ name: "Minimal", value: "minimal" },
		] as const satisfies ReadonlyArray<{
			name: Capitalize<FileViewSettings["mode"]>;
			value: FileViewSettings["mode"];
		}>;

		return (
			<div class="flex flex-col gap-2">
				<div class="font-semibold">Display Mode:</div>

				<div class="flex gap-4 flex-wrap **:[_input]:ml-2">
					<For each={options}>
						{({ name, value }) => {
							const isSelected = () => value === fileViewSettings.mode;

							return (
								<label>
									{name}
									<input
										type="radio"
										name={displayModeRadioBtnName}
										class={`radio ${isSelected() ? "radio-primary" : "radio-secondary"}`}
										checked={isSelected()}
										onInput={(_) =>
											setFileViewSettings(
												produce((state) => {
													state.mode = value;
												}),
											)
										}
									/>
								</label>
							);
						}}
					</For>
				</div>
			</div>
		);
	}

	function SortParamRadioBtns() {
		const options = [
			{ name: "Date", value: "date" },
			{ name: "Name", value: "name" },
			{ name: "Size", value: "size" },
			{ name: "Type", value: "type" },
		] as const satisfies ReadonlyArray<{
			name: Capitalize<FileViewSettings["sorting"]["param"]>;
			value: FileViewSettings["sorting"]["param"];
		}>;

		return (
			<div class="flex flex-col gap-2">
				<div class="font-semibold">Sorting Mode:</div>

				<div class="flex gap-4 flex-wrap **:[_input]:ml-2">
					<For each={options}>
						{({ name, value }) => {
							const isSelected = () => value === fileViewSettings.sorting.param;

							return (
								<label>
									{name}
									<input
										type="radio"
										name={sortParamRadioBtnName}
										class={`radio ${isSelected() ? "radio-primary" : "radio-secondary"}`}
										checked={isSelected()}
										onInput={(_) =>
											setFileViewSettings(
												produce((state) => {
													state.sorting.param = value;
												}),
											)
										}
									/>
								</label>
							);
						}}
					</For>
				</div>
			</div>
		);
	}

	function SortDirectionRadioBtns() {
		const options = [
			{ name: "Ascending", value: "asc" },
			{ name: "Descending", value: "desc" },
		] as const satisfies ReadonlyArray<{
			name: string;
			value: FileViewSettings["sorting"]["order"];
		}>;

		return (
			<div class="flex flex-col gap-2">
				<div class="font-semibold">Sorting Direction:</div>

				<div class="flex gap-4 flex-wrap **:[_input]:ml-2">
					<For each={options}>
						{({ name, value }) => {
							const isSelected = () => value === fileViewSettings.sorting.order;

							return (
								<label>
									{name}
									<input
										type="radio"
										name={sortDirectionRadioBtnName}
										class={`radio ${isSelected() ? "radio-primary" : "radio-secondary"}`}
										checked={isSelected()}
										onInput={(_) =>
											setFileViewSettings(
												produce((state) => {
													state.sorting.order = value;
												}),
											)
										}
									/>
								</label>
							);
						}}
					</For>
				</div>
			</div>
		);
	}

	return (
		<GenericModal modalId={prop.modalId}>
			<h3 class="font-bold text-xl mb-4">File View Settings</h3>

			{/* <p class="mb-3">
				This is where you can change how the files and folders are displayed.
			</p> */}

			<div class="flex flex-col gap-4">
				<DisplayModeRadioBtns />

				<SortParamRadioBtns />

				<SortDirectionRadioBtns />
			</div>
		</GenericModal>
	);
}
