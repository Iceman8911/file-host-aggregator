import { FILE_HOST_ROOT, ROOT_PATH } from "~/shared/constants";
import type {
	AbsoluteDirectoryPath,
	AbsoluteDirectoryPathString,
	AbsoluteFileOrDirectoryPath,
	AbsoluteFileOrDirectoryPathString,
	AbsoluteFilePath,
	AbsoluteFilePathString,
	AnyDirectoryPath,
	AnyDirectoryPathString,
	AnyFileOrDirectoryPath,
	AnyFileOrDirectoryPathString,
	AnyFilePath,
	AnyFilePathString,
	FileName,
	RelativeDirectoryPath,
	RelativeDirectoryPathString,
	RelativeFileOrDirectoryPath,
	RelativeFileOrDirectoryPathString,
	RelativeFilePath,
	RelativeFilePathString,
	RootPath,
	RootPathString,
} from "~/types/path";
import { isFileName } from "./file-name";

const pathSeperator = "/";
const pathCache = new WeakMap<Readonly<AnyFileOrDirectoryPath>, string>();

export function convertPathToString(path: Readonly<RootPath>): RootPathString;
export function convertPathToString(
	path: Readonly<AbsoluteFilePath>,
): AbsoluteFilePathString;
export function convertPathToString(
	path: Readonly<AbsoluteDirectoryPath>,
): AbsoluteDirectoryPathString;
export function convertPathToString(
	path: Readonly<AbsoluteFileOrDirectoryPath>,
): AbsoluteFileOrDirectoryPathString;
export function convertPathToString(
	path: Readonly<RelativeFilePath>,
): RelativeFilePathString;
export function convertPathToString(
	path: Readonly<RelativeDirectoryPath>,
): RelativeDirectoryPathString;
export function convertPathToString(
	path: Readonly<RelativeFileOrDirectoryPath>,
): RelativeFileOrDirectoryPathString;
export function convertPathToString(
	path: Readonly<AnyFilePath>,
): AnyFilePathString;
export function convertPathToString(
	path: Readonly<AnyDirectoryPath>,
): AnyDirectoryPathString;
export function convertPathToString(
	path: Readonly<AnyFileOrDirectoryPath>,
): AnyFileOrDirectoryPathString;
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
	pathString: Readonly<AbsoluteFilePathString>,
): AbsoluteFilePath;
export function convertStringToPath(
	pathString: Readonly<AbsoluteDirectoryPathString>,
): AbsoluteDirectoryPath;
export function convertStringToPath(
	pathString: Readonly<AbsoluteFileOrDirectoryPathString>,
): AbsoluteFileOrDirectoryPath;
export function convertStringToPath(
	pathString: Readonly<RelativeFilePathString>,
): RelativeFilePath;
export function convertStringToPath(
	pathString: Readonly<RelativeDirectoryPathString>,
): RelativeDirectoryPath;
export function convertStringToPath(
	pathString: Readonly<RelativeFileOrDirectoryPathString>,
): RelativeFileOrDirectoryPath;
export function convertStringToPath(
	pathString: Readonly<AnyFilePathString>,
): AnyFilePath;
export function convertStringToPath(
	pathString: Readonly<AnyDirectoryPathString>,
): AnyDirectoryPath;
export function convertStringToPath(
	pathString: Readonly<AnyFileOrDirectoryPathString | string>,
): AnyFileOrDirectoryPath;
export function convertStringToPath(
	pathString: Readonly<unknown>,
): AnyFileOrDirectoryPath {
	return typeof pathString === "string"
		? pathString.split(pathSeperator)
		: ROOT_PATH;
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

	return isFileName(possiblePath[possiblePath.length - 1]);
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

export function isRootPath(
	possiblePath: Readonly<AnyFileOrDirectoryPath>,
): possiblePath is RootPath {
	return possiblePath.toString() === ROOT_PATH.toString();
}

export function getLastNameInPath(path: Readonly<AnyFilePath>): FileName;
export function getLastNameInPath(path: Readonly<AnyDirectoryPath>): string;
export function getLastNameInPath(
	path: Readonly<AnyFileOrDirectoryPath>,
): string;
export function getLastNameInPath(
	path: Readonly<AnyFileOrDirectoryPath>,
): string {
	return path[path.length - 1];
}

export function getParentDirectoryPaths(
	path: Readonly<AbsoluteFileOrDirectoryPath>,
): ReadonlyArray<AbsoluteDirectoryPath>;
export function getParentDirectoryPaths(
	path: Readonly<RelativeFileOrDirectoryPath>,
): ReadonlyArray<RelativeDirectoryPath>;
export function getParentDirectoryPaths(
	path: Readonly<AnyFileOrDirectoryPath>,
): ReadonlyArray<AnyDirectoryPath> {
	// So that we won't include the 2 unnecessary values at the begining of an absolute paths
	const indexToStopAt = isAbsolutePath(path) ? 2 : 0;

	return path
		.map((_, index, arr) => {
			const indexToSlice = arr.length - index;

			return indexToSlice > indexToStopAt ? arr.slice(0, indexToSlice) : null;
		})
		.filter((val) => val != null);
}
