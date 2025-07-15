import { FileHostFile } from "~/classes/file-host-file";
import type { FileOrDirectoryOrFileHost } from "~/types/file-directory-file-host/file-directory-file-host";

export function isFileHostFile(
	possibleFileHostFile: FileOrDirectoryOrFileHost,
): possibleFileHostFile is FileHostFile {
	return possibleFileHostFile instanceof FileHostFile;
}
