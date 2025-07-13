import { FILE_HOST_ROOT, ROOT_PATH } from "~/shared/constants";
import type {
	AbsoluteDirectoryPath,
	AbsoluteFileOrDirectoryPath,
	AbsoluteFilePath,
	AnyDirectoryPath,
	AnyFileOrDirectoryPath,
	AnyFilePath,
	RelativeDirectoryPath,
	RelativeFileOrDirectoryPath,
	RelativeFilePath,
	RootPath,
} from "~/types/path";
import { isFileName } from "./file-name";

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
