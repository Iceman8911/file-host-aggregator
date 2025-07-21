import type { AbsoluteDirectoryPath, DirectoryName } from "../path";

export type DirectoryStats = {
	/** In bytes */
	size: number;
	/** The value of this is the same as the creation date of it's most recent descendant file or folder (recursive) */
	dateEdited: Date;
	/** Number of descendant files */
	fileCount: number;
	/** Number of descendant folders */
	folderCount: number;
	/** The absolute path to the folder */
	path: AbsoluteDirectoryPath;
	/** The name of the folder */
	name: DirectoryName;
};

export type ReadonlyDirectoryStats = Readonly<DirectoryStats>;
