import type { FileOrDirectoryPath } from "./types";

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
const pathCache = new WeakMap<FileOrDirectoryPath, string>();
export function convertPathToString(path: Readonly<FileOrDirectoryPath>) {
	return (
		pathCache.get(path) ?? pathCache.set(path, path.join("/")).get(path) ?? ""
	);
}
