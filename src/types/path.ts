import type { FileHost } from "~/classes/file-host";
import type { Brand } from "./generics";

/** Represents the path of a file from it's root (file host).
 *
 * Use `join("/")` to get the actual path: `""` */
export type RootPath = [];
/** The name and extension */
export type FileName = `${string}.${string}`;
/** Just a simple string. No branded nonsense for now */
export type DirectoryName = string;
export type FileOrDirectoryName = DirectoryName | FileName;

/** Use `join("/")` to get the actual path */
type FilePath = [...DirectoryName[], FileName];
/** Use `join("/")` to get the actual path */
type DirectoryPath = DirectoryName[];
type FileOrDirectoryPath = FilePath | DirectoryPath;

// The relative paths map to the root of the file host, and model how the file / directory exists on the file host.
export type RelativeFilePath = FilePath;
export type RelativeDirectoryPath = DirectoryPath;
export type RelativeFileOrDirectoryPath = FileOrDirectoryPath;

// The absolute paths are only used locally in the OPFS
export type AbsoluteFilePath = [
	...ReturnType<typeof FileHost.prototype.root>,
	...FilePath,
];
export type AbsoluteDirectoryPath = [
	...ReturnType<typeof FileHost.prototype.root>,
	...DirectoryPath,
];
export type AbsoluteFileOrDirectoryPath =
	| AbsoluteFilePath
	| AbsoluteDirectoryPath;

export type AnyFilePath = RelativeFilePath | AbsoluteFilePath;
export type AnyDirectoryPath = RelativeDirectoryPath | AbsoluteDirectoryPath;
export type AnyFileOrDirectoryPath =
	| RelativeFileOrDirectoryPath
	| AbsoluteFileOrDirectoryPath;

export type RelativeFilePathString = Brand<string, "relative-file-path">;
export type RelativeDirectoryPathString = Brand<
	string,
	"relative-directory-path"
>;
export type RelativeFileOrDirectoryPathString =
	| RelativeFilePathString
	| RelativeDirectoryPathString;

export type AbsoluteFilePathString = Brand<string, "absolute-file-path">;
export type AbsoluteDirectoryPathString = Brand<
	string,
	"absolute-directory-path"
>;
export type AbsoluteFileOrDirectoryPathString =
	| AbsoluteFilePathString
	| AbsoluteDirectoryPathString;

export type AnyFilePathString = RelativeFilePathString | AbsoluteFilePathString;
export type AnyDirectoryPathString =
	| RelativeDirectoryPathString
	| AbsoluteDirectoryPathString;
export type AnyFileOrDirectoryPathString =
	| RelativeFileOrDirectoryPathString
	| AbsoluteFileOrDirectoryPathString;

export type RootPathString = Brand<"", "root-path">;

export type UUID = ReturnType<typeof crypto.randomUUID>;
