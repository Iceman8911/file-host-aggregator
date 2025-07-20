import type { RootPath } from "~/types/path";

export const ROOT_PATH: RootPath = [];

export const DEFAULT_FILE_EXTENSION = "bin";
export const DEFAULT_FILE_HOST_EXTENSION = "filehost";
export const DEFAULT_FILE_NAME = `???.${DEFAULT_FILE_EXTENSION}`;

/** If a local file on the filesystem begins with this, it will be ignored when it's directory is iterated over */
export const FILE_ITERATOR_IGNORE_SUFFIX = "__IGNORE";

export const FILE_HOST_ROOT = "_file_host";
