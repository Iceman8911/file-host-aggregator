import type { FileHost } from "~/classes/file-host";

// Utility Generics
export type Brand<TType, TBrandName extends string> = TType & {
	readonly __brand: TBrandName;
};
export type ResultType<TResult> =
	| { state: "success"; result: TResult }
	| { state: "error"; error: unknown };
/** For getting all non-method properties of a class */
export type ClassPropsOnly<T> = {
	// biome-ignore lint/complexity: This is needs to be `Function`
	[K in keyof T as T[K] extends Function ? never : K]: T[K];
};
export type ExtractValueTypeFromPromise<TPromise extends Promise<unknown>> =
	TPromise extends Promise<infer TValue> ? TValue : never;

// Regular Types
/** Represents the path of a file from it's root (file host).
 *
 * Use `join("/")` to get the actual path: `""` */
export type RootPath = [];
/** The name and extension */
export type FileName = `${string}.${string}`;
/** Just a simple string. No branded nonsense for now */
export type DirectoryName = string;

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

export type UUID = ReturnType<typeof crypto.randomUUID>;
