import { DEFAULT_FILE_EXTENSION } from "~/shared/constants";
import type { FileName } from "~/types/path";

export function getExtensionFromFileName(name: FileName | string): string {
	const possibleExtension = name.slice(name.lastIndexOf(".") + 1);

	return name === possibleExtension ? "" : possibleExtension;
}

export function isFileName(str: string): str is FileName {
	return !!getExtensionFromFileName(str);
}

export function treatStringAsFileName(
	str: string,
	extToUse = DEFAULT_FILE_EXTENSION,
): FileName {
	return isFileName(str) ? str : `${str}.${extToUse}`;
}
