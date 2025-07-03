import { createStore } from "solid-js/store";
import type { FileHostImplementations } from "~/classes/file-host";
import type { FilePath } from "./types";

/** This is used to determine what files / filehosts should be shown */
type FilePathTracker = {
	/** If `null`, do not bother with the `path`. Assume that no file host has been selected */
	fileHost: FileHostImplementations | null;
	path: FilePath;
};

export const [gFilePathTracker, gSetFilePathTracker] =
	createStore<FilePathTracker>({ fileHost: null, path: "/" });
