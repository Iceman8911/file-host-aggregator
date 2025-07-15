import type { DirectoryStats } from "~/types/file-directory-file-host/directory";
import type { FileOrDirectoryOrFileHost } from "~/types/file-directory-file-host/file-directory-file-host";
import { isFileHostFile } from "./file";
import { isFileHost } from "./file-host";

export function isDirectory(
	possibleDirectory: FileOrDirectoryOrFileHost,
): possibleDirectory is DirectoryStats {
	return !isFileHost(possibleDirectory) && !isFileHostFile(possibleDirectory);
}
