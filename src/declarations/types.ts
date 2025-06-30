// Utility Generics
export type Brand<TType, TBrandName extends string> = TType & {
	readonly __brand: TBrandName;
};
export type ResultType<TResult> =
	| { state: "success"; result: TResult }
	| { state: "error"; code: number; message: string };
/** For getting all non-method properties of a class */
export type ClassPropsOnly<T> = {
	[K in keyof T as T[K] extends Function ? never : K]: T[K];
};

// Regular Types
/** Represents the path of a file from it's root (file host) */
export type FilePath = "/" | `/${string}`;
export type FilePathWithExtension = `/${string}.${string}`;
export type UUID = ReturnType<typeof crypto.randomUUID>;
