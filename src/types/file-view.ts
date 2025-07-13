import type { FileOrDirectory } from "./file-directory-file-host/file-directory-file-host";
import type { FileHostImplementations } from "./file-directory-file-host/file-host";
import type { RelativeDirectoryPath } from "./path";

type FilePathTracker = {
	/** If `null`, do not bother with the `path`. Assume that no file host has been selected */
	fileHost: FileHostImplementations | null;

	/** Path relative to the `root` of the fileHost.
	 *
	 * **Don't forget to combine both values, when using the path**
	 */
	relativePath: RelativeDirectoryPath;
};

export type FileView_Settings = {
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

/** I hate that I actually wrote this >~< */
export type FilesOrDirectoriesOrFileHosts =
	| FileOrDirectory[]
	| FileHostImplementations[]
	| null;
