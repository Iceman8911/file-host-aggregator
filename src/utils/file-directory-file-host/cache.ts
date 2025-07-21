import { hfs } from "@humanfs/web";
import type { Options } from "quick-lru";
import { FileHostFile } from "~/classes/file-host-file";
import { ReactiveLRU } from "~/classes/reactive-lru-cache";
import { DEVICE_MEMORY, FILE_ITERATOR_IGNORE_SUFFIX } from "~/shared/constants";
import type {
	DirectoryStats,
	ReadonlyDirectoryStats,
} from "~/types/file-directory-file-host/directory";
import type {
	AbsoluteDirectoryPath,
	AbsoluteDirectoryPathString,
	AbsoluteFileOrDirectoryPathString,
	AbsoluteFilePath,
	AbsoluteFilePathString,
} from "~/types/path";
import {
	convertPathToString,
	convertStringToPath,
	getNameFromPath,
	isPathValidForIterating,
} from "../path";

const GENERIC_CACHE_CONFIG = {
	maxSize: DEVICE_MEMORY * 50,
	maxAge: 60000,
} as const satisfies Options<unknown, unknown>;

const FILE_CONTENT_CACHE_CONFIG = {
	maxSize: DEVICE_MEMORY * 25,
	maxAge: 30000,
} as const satisfies Options<unknown, unknown>;

const FILE_CONTENT_EXTENSION = "blob";

type FileContentCacheKey =
	`${AbsoluteFilePathString}.${typeof FILE_CONTENT_EXTENSION}${typeof FILE_ITERATOR_IGNORE_SUFFIX}`;

function convertToFileContentCacheKey(
	path: AbsoluteFilePath,
): FileContentCacheKey {
	return `${convertPathToString(path)}.${FILE_CONTENT_EXTENSION}${FILE_ITERATOR_IGNORE_SUFFIX}`;
}

/** Caches the actual binary data of a file */
const fileContentCache = new ReactiveLRU<FileContentCacheKey, Blob>(
	FILE_CONTENT_CACHE_CONFIG,
);

/** Contains methods for interacting with binary file content */
const fileContentCacheService = {
	/** When data is requested, the cache is first searched, then the OPFS (which is then added to the cache), otherwise, returns `null` */
	async get(path: AbsoluteFilePath): Promise<Blob | null> {
		const pathToStoredBlobData = convertToFileContentCacheKey(path);

		const cachedData = fileContentCache.get(pathToStoredBlobData);

		if (cachedData) {
			return cachedData;
		} else {
			const storedDataInFileSystem = await hfs.bytes(pathToStoredBlobData);

			if (storedDataInFileSystem) {
				const blob = new Blob([storedDataInFileSystem]);

				fileContentCache.set(pathToStoredBlobData, blob);

				return blob;
			}

			return null;
		}
	},

	/** Adds the blob to the cache and then the disk
	 *
	 * @returns the stored blob
	 */
	async set(path: AbsoluteFilePath, data: Blob): Promise<Blob> {
		const pathToStoreBlobData = convertToFileContentCacheKey(path);

		fileContentCache.set(pathToStoreBlobData, data);

		await hfs.write(pathToStoreBlobData, await data.arrayBuffer());

		return data;
	},

	/** Removes the blob from cache and disk
	 *
	 * @returns an object containing booleans indicating successful deletions
	 */
	async delete(
		path: AbsoluteFilePath,
	): Promise<Readonly<{ cache: boolean; disk: boolean }>> {
		const pathToDeleteBlobData = convertToFileContentCacheKey(path);

		return {
			cache: fileContentCache.delete(pathToDeleteBlobData),
			disk: await hfs.delete(pathToDeleteBlobData),
		};
	},
} as const;

/** Caches the initialized file classes (what we'll actually use) */
const fileCache = new ReactiveLRU<AbsoluteFilePathString, FileHostFile>(
	GENERIC_CACHE_CONFIG,
);

/** Contains methods for interacting with file host files */
const fileCacheService = {
	async get(path: AbsoluteFilePath): Promise<FileHostFile | null> {
		const pathString = convertPathToString(path);

		const cachedInstance = fileCache.get(pathString);

		if (cachedInstance) {
			return cachedInstance;
		} else {
			const instance = await FileHostFile.loadFromDisk(path);

			if (instance) {
				fileCache.set(pathString, instance);
			}

			return instance;
		}
	},

	/** Just adds the file to the cache, since it's metadata is saved upon class initialization */
	set(fileHostFile: FileHostFile): void {
		const absolutePathString = convertPathToString(
			fileHostFile.metadata.absolutePath,
		);

		fileCache.set(absolutePathString, fileHostFile);
	},

	delete(path: AbsoluteFilePath): void {
		const absolutePathString = convertPathToString(path);

		fileCache.delete(absolutePathString);
	},
} as const;

type DirectoryEntry =
	| { path: AbsoluteDirectoryPathString; type: "dir" }
	| { path: AbsoluteFilePathString; type: "file" };

// type DirectoryEntryCount = { file: number; folder: number };

/** Caches the absolute paths to direct child files and sub-directories for a specifc directory */
const directoryEntryCache = new ReactiveLRU<
	AbsoluteDirectoryPathString,
	ReadonlyArray<DirectoryEntry>
>(GENERIC_CACHE_CONFIG);

/** Caches the relevant stats for a specifc directory */
const directoryStatCache = new ReactiveLRU<
	AbsoluteDirectoryPathString,
	ReadonlyDirectoryStats
>(GENERIC_CACHE_CONFIG);

/** Contains methods for getting the paths within a directory */
const directoryCacheService = {
	/** Returns the paths (strings) to direct child files and sub-directories in the current directory */
	async getChildren(
		directory: AbsoluteDirectoryPath,
	): Promise<ReadonlyArray<DirectoryEntry>> {
		const directoryPathString = convertPathToString(directory);

		const cachedPathStrings = directoryEntryCache.get(directoryPathString);

		if (cachedPathStrings) return cachedPathStrings;
		else {
			const tempPaths: DirectoryEntry[] = [];

			for await (const childEntry of hfs.list(directoryPathString)) {
				//@ts-expect-error
				const childPath: AbsoluteFileOrDirectoryPathString =
					convertPathToString([directoryPathString, childEntry.name]);

				if (isPathValidForIterating(childPath)) {
					tempPaths.push(
						//@ts-expect-error
						childEntry.isFile
							? { path: childPath, type: "file" }
							: { path: childPath, type: "dir" },
					);
				}
			}

			directoryEntryCache.set(directoryPathString, tempPaths);

			return tempPaths;
		}
	},

	/** Returns the paths to all child and descendant / nested files and sub-directories in the given path,
	 *
	 * @returns a generator since these can be really large
	 */
	async *getDescendants(
		directory: AbsoluteDirectoryPath,
	): AsyncGenerator<DirectoryEntry> {
		for (const childPath of await directoryCacheService.getChildren(
			directory,
		)) {
			yield childPath;

			if (childPath.type === "dir") {
				yield* directoryCacheService.getDescendants(
					convertStringToPath(childPath.path),
				);
			}
		}
	},

	/** Gets the relevant directory stats of the given directory path */
	async getStats(
		directoryPath: AbsoluteDirectoryPath,
	): Promise<ReadonlyDirectoryStats> {
		const directoryPathString = convertPathToString(directoryPath);

		const cachedDirectoryStats = directoryStatCache.get(directoryPathString);

		if (cachedDirectoryStats) return cachedDirectoryStats;

		const descendants = directoryCacheService.getDescendants(directoryPath);

		let fileCount = 0;
		let folderCount = 0;
		const filePromises: Promise<FileHostFile | null>[] = [];

		for await (const entry of descendants) {
			if (entry.type === "file") {
				fileCount++;
				filePromises.push(
					FileHostFile.getInstance(convertStringToPath(entry.path)),
				);
			} else {
				folderCount++;
			}
		}

		const generatedDirectoryStats = (
			await Promise.allSettled(filePromises)
		).reduce<DirectoryStats>(
			(acc, val) => {
				if (val.status === "fulfilled" && val.value) {
					acc.dateEdited =
						val.value.metadata.dateCreated > acc.dateEdited
							? val.value.metadata.dateCreated
							: acc.dateEdited;
					acc.size += val.value.metadata.size;
				}

				return acc;
			},
			{
				dateEdited: new Date(0),
				fileCount,
				folderCount,
				name: getNameFromPath(directoryPath),
				path: directoryPath,
				size: 0,
			},
		);

		directoryStatCache.set(directoryPathString, generatedDirectoryStats);

		return generatedDirectoryStats;
	},

	/** Clears the cached entries for the given directories */
	clearCache(...directoriesToRefresh: ReadonlyArray<AbsoluteDirectoryPath>) {
		directoriesToRefresh.forEach((val) => {
			directoryEntryCache.delete(convertPathToString(val));
			directoryStatCache.delete(convertPathToString(val));
		});
	},

	/** Clears all the cached entries */
	clearAllCaches(): void {
		directoryEntryCache.clear();
		directoryStatCache.clear();
	},
} as const;

export { fileContentCacheService, directoryCacheService, fileCacheService };
