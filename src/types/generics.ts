export type Brand<TType, TBrandName extends string> = TType & {
	readonly __brand: TBrandName;
};

export type ResultType<TResult> =
	| { state: "success"; result: TResult }
	| { state: "error"; error: unknown };

/** For getting all non-method properties of a class */
export type ClassPropsOnly<T> = {
	// biome-ignore lint/complexity/noBannedTypes: <explanation>For use in a generic
	[K in keyof T as T[K] extends Function ? never : K]: T[K];
};

export type ExtractValueTypeFromPromise<TPromise extends Promise<unknown>> =
	TPromise extends Promise<infer TValue> ? TValue : never;
