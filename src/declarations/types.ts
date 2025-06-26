import type { generateUUID } from "./functions";

// Utility Generics
export type Brand<TType, TBrandName extends string> = TType & {
	readonly __brand: TBrandName;
};

// Regular Types
/** Represents the path of a file from it's root (file host) */
export type FilePath = "./" | `./${string}/` | `/${string}/`;
export type UUID = ReturnType<typeof generateUUID>;
