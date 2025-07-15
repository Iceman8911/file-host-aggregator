import { DEFAULT_FILE_HOST_EXTENSION } from "~/shared/constants";
import type { FileName } from "~/types/path";

export function getExtensionFromFileName(name: FileName | string): string {
	return name.slice(name.lastIndexOf(".") + 1);
}

export function isFileName(str: string): str is FileName {
	return !!getExtensionFromFileName(str);
}

export function treatStringAsFileName(str: string): FileName {
	return isFileName(str) ? str : `${str}.${DEFAULT_FILE_HOST_EXTENSION}`;
}
