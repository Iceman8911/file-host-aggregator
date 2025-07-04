import { createStore } from "solid-js/store";
import type { FileHostImplementations } from "~/classes/file-host";
import type { DirectoryPath, FilePath, RootPath } from "./types";

/** This is used to determine what files / filehosts should be shown */
type FilePathTracker = {
	/** If `null`, do not bother with the `path`. Assume that no file host has been selected */
	fileHost: FileHostImplementations | null;

	/** Path relative to the `root` of the fileHost.
	 *
	 * **Don't forget to combine both values, when using the path**
	 */
	relativePath: DirectoryPath;
};

export const ROOT_PATH: RootPath = [];
export const DEFAULT_FILE_NAME = "???.bin";

export const [gFilePathTracker, gSetFilePathTracker] =
	createStore<FilePathTracker>({ fileHost: null, relativePath: ROOT_PATH });
