import { createAsync } from "@solidjs/router";
import CopyIcon from "lucide-solid/icons/copy";
import DownloadIcon from "lucide-solid/icons/download";
import DefaultFileIcon from "lucide-solid/icons/file";
import OpenedFolderIcon from "lucide-solid/icons/folder-open";
import HardDriveIcon from "lucide-solid/icons/hard-drive";
import InfoIcon from "lucide-solid/icons/info";
import MoveIcon from "lucide-solid/icons/move-up-left";
import TrashIcon from "lucide-solid/icons/trash-2";
import NoInternetIcon from "lucide-solid/icons/wifi-off";
import { Match, Show, Switch } from "solid-js";
import { FileHost } from "~/classes/file-host";
import { FileHostFile } from "~/classes/file-host-file";
import type { FileOrDirectoryOrFileHost } from "~/types/file-directory-file-host/file-directory-file-host";
import type { RelativeFilePath } from "~/types/path";
import { isDirectory } from "~/utils/file-directory-file-host/directory";
import { isFileHostFile } from "~/utils/file-directory-file-host/file";
import { gIsUserConnectedToInternet } from "~/utils/internet";
import { downloadBlobToDisk } from "~/utils/other";
import { FileView_Shared } from "../file-view";

export function FileView_ContextMenu(prop: {
	data: FileOrDirectoryOrFileHost;
}) {
	async function downloadFileOrDirectoryToDisk() {
		if (isFileHostFile(prop.data)) {
			prop.data.downloadFileToDisk();
		} else if (isDirectory(prop.data)) {
			const fileHost = FileHost.getFileHostFromAbsolutePath(prop.data.path);

			if (fileHost) {
				const filesToArchive: Parameters<typeof archiveFiles>[0] = [];

				const filesToArchivePromises: Array<
					Promise<{ data: ArrayBuffer; path: RelativeFilePath } | null>
				> = [];

				for await (const possibleFile of fileHost.scanDirectoryForDescendantFiles(
					prop.data.path,
				)) {
					// Don't individually wait on each request
					filesToArchivePromises.push(
						possibleFile.getBlob().then(async (blob) => {
							if (blob) {
								return {
									data: await blob.arrayBuffer(),
									path: possibleFile.metadata.relativePath,
								};
							} else {
								return null;
							}
						}),
					);
				}

				(await Promise.allSettled(filesToArchivePromises)).forEach((result) => {
					if (result.status === "fulfilled" && result.value) {
						const {
							value: { data, path },
						} = result;

						filesToArchive.push({
							data,
							path,
						});
					}
				});

				const { archiveFiles } = await import("~/utils/fflate-archiving");
				const zipRes = await archiveFiles(filesToArchive);

				downloadBlobToDisk(zipRes, zipRes.name);
			}
		}
	}

	async function deleteFileOrDirectoryFromDiskAndFileHost() {
		if (isFileHostFile(prop.data)) {
			const fileHost = prop.data.metadata.fileHost;

			if (fileHost) {
				await fileHost.deleteFile(prop.data.metadata.relativePath);
			}
		} else if (isDirectory(prop.data)) {
			const fileHost = FileHost.getFileHostFromAbsolutePath(prop.data.path);

			if (fileHost) {
				await fileHost.deleteDirectory(
					FileHost.getRelativePathFromAbsolutePath(prop.data.path),
				);
			}
		}
	}

	const hasStableInternet = createAsync(() => gIsUserConnectedToInternet(), {
		initialValue: false,
	});

	return (
		<>
			<UniqueOptions data={prop.data} />

			<li>
				<button type="button" onClick={downloadFileOrDirectoryToDisk}>
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

			{/* The Delete button shouldn't work offline */}
			<li class={!hasStableInternet.latest ? "menu-disabled" : ""}>
				<button
					type="button"
					class={`text-error ${!hasStableInternet.latest ? "brightness-50" : ""}`}
					onClick={deleteFileOrDirectoryFromDiskAndFileHost}
					disabled={!hasStableInternet.latest}
				>
					<TrashIcon />
					Delete
					<Show when={!hasStableInternet.latest}>
						<NoInternetIcon />
					</Show>
				</button>
			</li>

			<li>
				<button
					type="button"
					onClick={() => {
						FileView_Shared.handleShowFileOrDirectoryOrFileHostDetails(
							prop.data,
						);
					}}
				>
					<InfoIcon />
					Details
				</button>
			</li>
		</>
	);
}

function UniqueOptions(prop: { data: FileOrDirectoryOrFileHost }) {
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
							onClick={() =>
								FileView_Shared.handleOpenFileOrDirectoryOrFileHost(val())
							}
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
							<button type="button" onClick={(_) => file().getBlob()}>
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
