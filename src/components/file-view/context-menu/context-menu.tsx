import CopyIcon from "lucide-solid/icons/copy";
import DownloadIcon from "lucide-solid/icons/download";
import DefaultFileIcon from "lucide-solid/icons/file";
import OpenedFolderIcon from "lucide-solid/icons/folder-open";
import HardDriveIcon from "lucide-solid/icons/hard-drive";
import InfoIcon from "lucide-solid/icons/info";
import MoveIcon from "lucide-solid/icons/move-up-left";
import TrashIcon from "lucide-solid/icons/trash-2";
import { Match, Show, Switch } from "solid-js";
import { FileHost } from "~/classes/file-host";
import { FileHostFile } from "~/classes/file-host-file";
import type { FileOrDirectoryOrFileHost } from "~/types/file-directory-file-host/file-directory-file-host";
import type { RelativeFilePath } from "~/types/path";
import { downloadBlobToDisk } from "~/utils/other";
import { FileView_Shared } from "../file-view";

export function FileView_ContextMenu(prop: {
	data: FileOrDirectoryOrFileHost;
}) {
	async function downloadFileOrDirectoryToDisk() {
		if (prop.data instanceof FileHostFile) {
			prop.data.downloadFileToDisk();
		} else if (!(prop.data instanceof FileHost)) {
			const allDirContents =
				(await FileHost.getFileHostFromAbsolutePath(
					prop.data.path,
				)?.getDirContentsRecursively(prop.data.path)) ?? [];

			if (!allDirContents.length) return;

			const filesToArchive: Parameters<typeof archiveFiles>[0] = [];
			const filesToArchivePromises: Array<
				Promise<{ data: ArrayBuffer; path: RelativeFilePath }>
			> = [];

			for (const possibleFile of allDirContents) {
				if (possibleFile instanceof FileHostFile) {
					// Don't individually wait on each request
					filesToArchivePromises.push(
						possibleFile.getFile().then((blob) =>
							blob.arrayBuffer().then((buffer) => {
								return {
									data: buffer,
									path: possibleFile.relativePath,
								};
							}),
						),
					);
				}
			}

			(await Promise.allSettled(filesToArchivePromises)).forEach((result) => {
				if (result.status === "fulfilled") {
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
