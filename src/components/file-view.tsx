import { createAsync } from "@solidjs/router";
import CloudIcon from "lucide-solid/icons/cloud";
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
import RefreshIcon from "lucide-solid/icons/refresh-ccw";
import SearchIcon from "lucide-solid/icons/search";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	Match,
	Show,
	Suspense,
	Switch,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Dynamic } from "solid-js/web";
import {
	FileHost,
	type FileHostFile,
	type FileHostImplementations,
	FileType,
} from "~/classes/file-host";
import { quickSort } from "~/declarations/async-quick-sort";
import { gFileHostIcons } from "~/declarations/icons";
import type { DirectoryPath } from "~/declarations/types";
import { ROOT_PATH } from "~/declarations/variables";

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

type FilesOrFileHosts =
	| ({ type: "dir"; name: string } | { type: "file"; file: FileHostFile })[]
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

	const _fetchedFilesOrFileHosts = createMemo<Promise<FilesOrFileHosts>>(
		async () => {
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
		},
	);

	/** stuff like sorting */
	const _processedFilesOrFileHosts = createMemo<Promise<FilesOrFileHosts>>(
		async () => {
			const originalFilesOrFileHosts = await _fetchedFilesOrFileHosts();
			if (!originalFilesOrFileHosts) return [];

			//@ts-expect-error Yeah, I messed up the types, but it works :D
			const sorted: FilesOrFileHosts = await quickSort<
				| ({ type: "dir"; name: string } | { type: "file"; file: FileHostFile })
				| FileHostImplementations
			>(originalFilesOrFileHosts, async (a, b) => {
				const sortingData = fileViewSettings.sorting;

				switch (sortingData.param) {
					case "name": {
						const nameOfA =
							a instanceof FileHost || a.type === "dir"
								? a.name
								: a.file.name(true);
						const nameOfB =
							b instanceof FileHost || b.type === "dir"
								? b.name
								: b.file.name(true);

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
								: a.type === "file"
									? a.file.dateCreated.getTime()
									: Date.now();
						const dateOfB =
							b instanceof FileHost
								? b.dateCreated.getTime()
								: b.type === "file"
									? b.file.dateCreated.getTime()
									: Date.now();

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
								: a.type === "file"
									? a.file.dateCreated.getTime()
									: Date.now();
						const sizeOfB =
							b instanceof FileHost
								? b.dateCreated.getTime()
								: b.type === "file"
									? b.file.dateCreated.getTime()
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
		},
	);

	const displayedFilesOrFileHosts = createAsync(() =>
		_processedFilesOrFileHosts(),
	);

	return (
		<div class="grid grid-cols-[1fr_32.5%] sm:grid-cols-[1fr_20%] grid-rows-[2.5rem_1fr] gap-4 p-4 size-full *:bg-base-200 *:rounded-field *:w-full">
			{/* Breadcrumbs bar */}
			<div class="breadcrumbs text-sm sm:text-[1.025rem] px-4 text-primary overflow-y-clip scrollbar-thin select-none">
				<ul class="*:last:font-bold">
					<li>
						<button
							type="button"
							onClick={(_) =>
								setFileViewSettings(
									produce((state) => {
										state.pathData.fileHost = null;
									}),
								)
							}
						>
							<CloudIcon />
							File Hosts
						</button>
					</li>

					<Show when={fileViewSettings.pathData.fileHost}>
						{(fileHost) => {
							const relativePath = () => fileViewSettings.pathData.relativePath;

							return (
								<>
									<li>
										<button
											type="button"
											onClick={(_) => {
												setFileViewSettings(
													produce((state) => {
														state.pathData.relativePath = ROOT_PATH;
													}),
												);
											}}
										>
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
														onClick={(_) => {
															// Move back to the folder the button represents
															setFileViewSettings(
																produce((state) => {
																	state.pathData.relativePath =
																		state.pathData.relativePath.slice(
																			0,
																			index() + 1,
																		);
																}),
															);
														}}
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

			{/* Utility icons */}
			<div class="flex gap-2 justify-center items-center *:btn *:btn-primary *:btn-soft *:btn-sm *:p-1 *:rounded-2xl">
				<button type="button">
					<SearchIcon />
				</button>{" "}
				<button
					type="button"
					disabled={!fileViewSettings.pathData.fileHost}
					onClick={(_) => {
						if (fileViewSettings.isRefreshing === true) return;

						setFileViewSettings(
							produce(async (state) => {
								state.isRefreshing = true;

								// Refetch the data
								await state.pathData.fileHost?.downloadFiles();

								state.isRefreshing = false;
							}),
						);
					}}
				>
					<Show when={fileViewSettings.isRefreshing} fallback={<RefreshIcon />}>
						<span class="loading loading-spinner"></span>
					</Show>
				</button>
			</div>

			{/* Folder/File view */}
			<div class="col-[1_/_3] flex flex-wrap place-content-start gap-4 md:gap-8 p-4 select-none overflow-y-auto">
				<Suspense
					fallback={
						<div class="size-full flex items-center justify-center">
							<span class="loading loading-spinner loading-xl text-primary scale-200"></span>
						</div>
					}
				>
					<For each={displayedFilesOrFileHosts()}>
						{(val) => {
							const name = val.type === "file" ? val.file.name(true) : val.name;

							return (
								<button
									type="button"
									class="relative flex flex-col justify-center items-center w-1/6 min-w-20 max-w-25 h-fit aspect-square btn btn-primary btn-soft text-xs sm:text-sm"
									title={name}
									onClick={(_) => {
										setFileViewSettings(
											produce((state) => {
												if (val instanceof FileHost) {
													state.pathData.fileHost = val;
													state.pathData.relativePath = ROOT_PATH;
												} else if (val.type === "dir") {
													state.pathData.relativePath = [
														state.pathData.relativePath,
														val.name,
													].flat();
												}
											}),
										);
									}}
								>
									{/* <div
										class="tooltip tooltip-bottom absolute size-full"
										data-tip={name}
									> */}
									<div class="relative size-fit *:first:size-16">
										<Switch>
											<Match when={val instanceof FileHost}>
												<HardDriveIcon />
												<Dynamic
													component={gFileHostIcons[(val as FileHost).type]}
													class="absolute right-0 bottom-0 size-6 opacity-75"
												/>
											</Match>

											<Match when={val.type === "dir"}>
												<DefaultFolderIcon />
											</Match>

											<Match when={val.type === "file" && val.file}>
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
									</div>

									<p class="font-bold overflow-clip text-ellipsis whitespace-nowrap w-full">
										{name}
									</p>
									{/* </div> */}
								</button>
							);
						}}
					</For>
				</Suspense>
			</div>
		</div>
	);
}
