// Utility Generics
export type Brand<TType, TBrandName extends string> = TType & {
	readonly __brand: TBrandName;
};
export type ResultType<TResult> =
	| { state: "success"; result: TResult }
	| { state: "error"; error: unknown };
/** For getting all non-method properties of a class */
export type ClassPropsOnly<T> = {
	[K in keyof T as T[K] extends Function ? never : K]: T[K];
}; // Regular Types
/** Represents the path of a file from it's root (file host).
 *
 * Use `join("/")` to get the actual path: `""` */
export type RootPath = [];
/** The name and extension */
export type FileName = `${string}.${string}`;
/** Just a simple string. No branded nonsense for now */
export type DirectoryName = string;
/** Use `join("/")` to get the actual path */
export type FilePath = [...DirectoryName[], FileName];
/** Use `join("/")` to get the actual path */
export type DirectoryPath = DirectoryName[];
export type FileOrDirectoryPath = FilePath | DirectoryPath;
export type UUID = ReturnType<typeof crypto.randomUUID>;
