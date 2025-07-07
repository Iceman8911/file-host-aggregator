import { createAsync } from "@solidjs/router";
import CloudIcon from "lucide-solid/icons/cloud";
import CopyIcon from "lucide-solid/icons/copy";
import DefaultFileIcon from "lucide-solid/icons/file";
import ArchiveFileIcon from "lucide-solid/icons/file-archive";
import AudioFileIcon from "lucide-solid/icons/file-audio";
import ImageFileIcon from "lucide-solid/icons/file-image";
import UnknownFileIcon from "lucide-solid/icons/file-question-mark";
import TextFileIcon from "lucide-solid/icons/file-text";
import DocumentFileIcon from "lucide-solid/icons/file-type";
import VideoFileIcon from "lucide-solid/icons/file-video";
import DefaultFolderIcon from "lucide-solid/icons/folder";
import ClosedFolderIcon from "lucide-solid/icons/folder-closed";
import OpenedFolderIcon from "lucide-solid/icons/folder-open";
import HardDriveIcon from "lucide-solid/icons/hard-drive";
import InfoIcon from "lucide-solid/icons/info";
import MoveIcon from "lucide-solid/icons/move-up-left";
import RefreshIcon from "lucide-solid/icons/refresh-ccw";
import SearchIcon from "lucide-solid/icons/search";
import TrashIcon from "lucide-solid/icons/trash-2";
import { createMemo, For, Match, Show, Suspense, Switch } from "solid-js";
import { createStore, produce, type SetStoreFunction } from "solid-js/store";
import { Dynamic } from "solid-js/web";
import {
	FileHost,
	FileHostFile,
	type FileHostImplementations,
	type FileOrDirectory,
	type FileOrDirectoryOrFileHost,
	FileType,
} from "~/classes/file-host";
import { quickSort } from "~/declarations/async-quick-sort";
import { generateUUID } from "~/declarations/functions";
import { gFileHostIcons } from "~/declarations/icons";
import type { DirectoryPath } from "~/declarations/types";
import { ROOT_PATH } from "~/declarations/variables";
import LoadingSpinner from "./loading-spinner";
import CustomContextMenu from "./menu/custom-context-menu";
import FileDetails from "./modal/file-details";

type FilePathTracker = {
	/** If `null`, do not bother with the `path`. Assume that no file host has been selected */
	fileHost: FileHostImplementations | null;

	/** Path relative to the `root` of the fileHost.
	 *
	 * **Don't forget to combine both values, when using the path**
	 */
	relativePath: DirectoryPath;
};

type FileViewSettings = {
	iconSize: "XS" | "S" | "M" | "L" | "XL";
	/** How the icons / file buttons will be displayed */
	mode: "grid" | "list" | "wrapped" | "minimal";
	/** This is used to determine what files / filehosts should be shown */
	pathData: FilePathTracker;
	/** Whether the file host(s) data is currently being refreshed */
	isRefreshing: boolean;
	/** How the files and folders should be sorted when displaying them */
	sorting: { param: "name" | "date" | "size" | "type"; order: "asc" | "desc" };
};

/** I hate that I actually wrote this >~< */
type FilesOrDirectoriesOrFileHosts =
	| FileOrDirectory[]
	| FileHostImplementations[]
	| null;

export default function FileView() {
	const defaultFileViewSettings: Readonly<FileViewSettings> = {
		iconSize: "M",
		isRefreshing: false,
		mode: "grid",
		pathData: { fileHost: null, relativePath: ROOT_PATH },
		// Sort alpabetically by default
		sorting: { order: "asc", param: "name" },
	};
	const [fileViewSettings, setFileViewSettings] = createStore<FileViewSettings>(
		defaultFileViewSettings,
	);

	const _fetchedFilesOrFileHosts = createMemo<
		Promise<FilesOrDirectoriesOrFileHosts>
	>(async () => {
		const fileHost = () => fileViewSettings.pathData.fileHost;
		const relativePath = () => fileViewSettings.pathData.relativePath;

		if (fileHost()) {
			// Workaround for typescript to know that the function call isn't null
			const fileHostVar = fileHost() as FileHostImplementations;

			return fileHostVar.getDirContents(
				[fileHostVar.root(), relativePath()].flat(),
			);
		}

		return Array.from(FileHost.collection.values());
	});

	/** stuff like sorting */
	const _processedFilesOrFileHosts = createMemo<
		Promise<FilesOrDirectoriesOrFileHosts>
	>(async () => {
		const originalFilesOrFileHosts = await _fetchedFilesOrFileHosts();
		if (!originalFilesOrFileHosts) return [];

		//@ts-expect-error Yeah, I messed up the types, but it works :D
		const sorted: FilesOrDirectoriesOrFileHosts = await quickSort<
			FileOrDirectory | FileHostImplementations
		>(originalFilesOrFileHosts, async (a, b) => {
			const sortingData = fileViewSettings.sorting;

			switch (sortingData.param) {
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
						sortingData.order === "asc"
							? nameOfA >= nameOfB
							: nameOfA <= nameOfB
					)
						? 1
						: -1;
				}
				// TODO: Add a way for obtaining folder dates.
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
						sortingData.order === "asc"
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
								? a.dateCreated.getTime()
								: Date.now();
					const sizeOfB =
						b instanceof FileHost
							? b.dateCreated.getTime()
							: b instanceof FileHostFile
								? b.dateCreated.getTime()
								: Date.now();

					return (
						sortingData.order === "asc"
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

		const result = sorted;
		return result;
	});

	const displayedFilesOrFileHosts = createAsync(() =>
		_processedFilesOrFileHosts(),
	);

	return (
		<div class="grid grid-cols-[1fr_32.5%] sm:grid-cols-[1fr_20%] grid-rows-[2.5rem_1fr] gap-4 p-4 size-full *:bg-base-200 *:rounded-field *:w-full">
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
			<div class="col-[1_/_3] flex flex-wrap place-content-start gap-4 md:gap-8 p-4 select-none overflow-y-auto">
				<Suspense fallback={<LoadingSpinner />}>
					<ListOfFilesAndFoldersAndFileHosts
						list={displayedFilesOrFileHosts()}
						settingsSetter={setFileViewSettings}
					/>
				</Suspense>
			</div>
		</div>
	);
}

function DirectoryPathBar(prop: {
	pathData: FilePathTracker;
	setter: SetStoreFunction<FileViewSettings>;
}) {
	const handleNavigateToFileHostsView = () => {
		prop.setter(
			produce((state) => {
				state.pathData.fileHost = null;
			}),
		);
	};

	const handleNavigateToFileHostRoot = () => {
		prop.setter(
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
		prop.setter(
			produce((state) => {
				state.pathData.relativePath = state.pathData.relativePath.slice(
					0,
					pathIndex + 1,
				);
			}),
		);
	};

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
		<div class="flex gap-2 justify-center items-center *:btn *:btn-primary *:btn-soft *:btn-sm *:p-1 *:rounded-2xl">
			<button type="button">
				<SearchIcon />
			</button>{" "}
			<button
				type="button"
				disabled={!settings().pathData.fileHost}
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
		(
			document.getElementById(fileDetailsDialogData.modalId) as
				| HTMLDialogElement
				| undefined
		)?.showModal();
	};

	function ContextMenu(prop: { data: FileOrDirectoryOrFileHost }) {
		return (
			<>
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
				</Switch>
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

	return (
		<>
			<For each={prop.list}>
				{(val) => {
					const name = val instanceof FileHostFile ? val.name(true) : val.name;

					return (
						<CustomContextMenu
							closeOnClick={true}
							contextMenu={<ContextMenu data={val} />}
						>
							<button
								type="button"
								class="relative flex flex-col justify-center items-center w-20 md:w-25 lg:w-30 h-fit aspect-square btn btn-primary btn-soft text-xs sm:text-sm"
								title={name}
								onClick={() => handleOpenFileOrDirectoryOrFileHost(val)}
							>
								<div class="relative size-fit *:first:size-16">
									<Thumbnail data={val} />
								</div>

								<p class="font-bold overflow-clip text-ellipsis whitespace-nowrap w-full">
									{name}
								</p>
							</button>
						</CustomContextMenu>
					);
				}}
			</For>

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
