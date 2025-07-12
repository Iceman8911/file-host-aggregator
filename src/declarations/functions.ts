import {
	FILE_HOST_ROOT,
	EXTENSION_REGEX as FILENAME_SPLIT_REGEX,
} from "~/classes/file-host";
import type {
	AbsoluteDirectoryPath,
	AbsoluteFileOrDirectoryPath,
	AbsoluteFilePath,
	AnyDirectoryPath,
	AnyFileOrDirectoryPath,
	AnyFilePath,
	FileName,
	RelativeDirectoryPath,
	RelativeFileOrDirectoryPath,
	RelativeFilePath,
} from "./types";

export const generateUUID = <
	TReturnType = ReturnType<typeof crypto.randomUUID>,
>() => crypto.randomUUID() as TReturnType;

export async function gIsUserConnectedToInternet(): Promise<boolean> {
	try {
		const response = await fetch("https://www.gstatic.com/generate_204", {
			method: "POST",
			mode: "no-cors",
		});

		if (response) return true;
		else return false;
	} catch (_) {
		return false;
	}
}

export async function gThrowIfNoInternet(): Promise<void> {
	if (!(await gIsUserConnectedToInternet()))
		throw Error("No connection detected.");
}

// For paths
const pathSeperator = "/";
const pathCache = new WeakMap<Readonly<AnyFileOrDirectoryPath>, string>();
export function convertPathToString(
	path: Readonly<AnyFileOrDirectoryPath>,
): string {
	return (
		pathCache.get(path) ??
		pathCache.set(path, path.join(pathSeperator)).get(path) ??
		""
	);
}
export function convertStringToPath(
	pathString: Readonly<string>,
): AnyFileOrDirectoryPath {
	return pathString.split(pathSeperator);
}

export function isAbsolutePath(
	possiblePath: Readonly<AnyFilePath>,
): possiblePath is AbsoluteFilePath;
export function isAbsolutePath(
	possiblePath: Readonly<AnyDirectoryPath>,
): possiblePath is AbsoluteDirectoryPath;
export function isAbsolutePath(
	possiblePath: Readonly<AnyFileOrDirectoryPath>,
): possiblePath is AbsoluteFileOrDirectoryPath;
export function isAbsolutePath(
	possiblePath: Readonly<AnyFileOrDirectoryPath>,
): possiblePath is AbsoluteFileOrDirectoryPath {
	if (!possiblePath.length) return false;

	return possiblePath[0] === FILE_HOST_ROOT;
}

export function isRelativePath(
	possiblePath: Readonly<AnyFilePath>,
): possiblePath is RelativeFilePath;
export function isRelativePath(
	possiblePath: Readonly<AnyDirectoryPath>,
): possiblePath is RelativeDirectoryPath;
export function isRelativePath(
	possiblePath: Readonly<AnyFileOrDirectoryPath>,
): possiblePath is RelativeFileOrDirectoryPath;
export function isRelativePath(
	possiblePath: Readonly<AnyFileOrDirectoryPath>,
): possiblePath is RelativeFileOrDirectoryPath {
	if (!possiblePath.length) return false;

	return !isAbsolutePath(possiblePath);
}

export function isFilePath(
	possiblePath: Readonly<AbsoluteFileOrDirectoryPath>,
): possiblePath is AbsoluteFilePath;
export function isFilePath(
	possiblePath: Readonly<RelativeFileOrDirectoryPath>,
): possiblePath is RelativeFilePath;
export function isFilePath(
	possiblePath: Readonly<AnyFileOrDirectoryPath>,
): possiblePath is AnyFilePath;
export function isFilePath(
	possiblePath: Readonly<AnyFileOrDirectoryPath>,
): possiblePath is AnyFilePath {
	if (!possiblePath.length) return false;

	return !!possiblePath[possiblePath.length - 1].split(FILENAME_SPLIT_REGEX)[1];
}

export function isDirectoryPath(
	possiblePath: Readonly<AbsoluteFileOrDirectoryPath>,
): possiblePath is AbsoluteDirectoryPath;
export function isDirectoryPath(
	possiblePath: Readonly<RelativeFileOrDirectoryPath>,
): possiblePath is RelativeDirectoryPath;
export function isDirectoryPath(
	possiblePath: Readonly<AnyFileOrDirectoryPath>,
): possiblePath is AnyDirectoryPath;
export function isDirectoryPath(
	possiblePath: Readonly<AnyFileOrDirectoryPath>,
): possiblePath is AnyDirectoryPath {
	if (!possiblePath.length) return false;

	return !isFilePath(possiblePath);
}

export function treatStringAsFileName(str: string): FileName {
	const existingExtension = str.split(FILENAME_SPLIT_REGEX)[1];

	return existingExtension ? (str as FileName) : `${str}.bin`;
}

export function convertDateToLegibleString(date: Date): string {
	return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

export function downloadBlobToDisk(blob: Blob, downloadName: string) {
	const blobUrl = URL.createObjectURL(blob);
	const link = Object.assign(document.createElement("a"), {
		download: downloadName,
		href: blobUrl,
	} satisfies Partial<HTMLAnchorElement>);
	link.click();
	URL.revokeObjectURL(blobUrl);
}
