import type { FileHostFile } from "~/classes/file-host-file";
import type { DirectoryStats } from "./directory";
import type { FileHostImplementations } from "./file-host";

export type FileOrDirectoryOrFileHost =
	| FileOrDirectory
	| FileHostImplementations;

export type FileOrDirectory = FileHostFile | DirectoryStats;
