import { hfs } from "@humanfs/web";
import { parse } from "@worker-tools/structured-json";
import { FileHost } from "~/classes/file-host";
import { DEFAULT_FILE_HOST_EXTENSION } from "~/shared/constants";
import { FILE_HOSTS } from "~/shared/enums";
import type { FileOrDirectoryOrFileHost } from "~/types/file-directory-file-host/file-directory-file-host";
import type {
	FileHostClassProps,
	FileHostID,
	FileHostImplementations,
} from "~/types/file-directory-file-host/file-host";
import { convertPathToString } from "../path";

/** Initializes all stored file hosts and returns an array of them as result */

export async function initFileHosts(): Promise<
	ReadonlyArray<FileHostImplementations>
> {
	const fileHosts: Array<FileHostImplementations> = [];
	const { root: fileHostRoot } = FileHost;

	// Load all file hosts from the disk
	for await (const entry of hfs.list(convertPathToString(fileHostRoot()))) {
		const { isFile, name } = entry;

		if (name.endsWith(`.${DEFAULT_FILE_HOST_EXTENSION}`) && isFile) {
			const fileHostId = name as FileHostID;
			const props: FileHostClassProps = parse(
				(await hfs.text(convertPathToString(fileHostRoot(fileHostId)))) ?? "",
			);
			const { type } = props;

			// TODO: Depending on the `.type`, instantiate the appropriate class
			switch (type) {
				case FILE_HOSTS.MEGA: {
					const { MEGASyncFileHost } = await import("~/classes/mega-sync");
					const instance = await MEGASyncFileHost.init({
						...props,
						restore: true,
					});
					if (instance) fileHosts.push(instance);
					break;
				}
			}
		}
	}

	return fileHosts;
}

export function isFileHost(
	possibleFileHost: FileOrDirectoryOrFileHost,
): possibleFileHost is FileHostImplementations {
	return possibleFileHost instanceof FileHost;
}
