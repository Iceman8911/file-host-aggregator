import { hfs } from "@humanfs/web";
import { ReactiveMap } from "@solid-primitives/map";
import { stringify } from "@worker-tools/structured-json";
import QuickLRU from "quick-lru";
import { DEFAULT_FILE_EXTENSION, FILE_HOST_ROOT } from "~/shared/constants";
import type { FILE_HOSTS } from "~/shared/enums";
import type { DirectoryStats } from "~/types/file-directory-file-host/directory";
import type { FileOrDirectory } from "~/types/file-directory-file-host/file-directory-file-host";
import type {
	FileHostID,
	FileHostImplementations,
} from "~/types/file-directory-file-host/file-host";
import type { ResultType } from "~/types/generics";
import type {
	AbsoluteDirectoryPath,
	AbsoluteFileOrDirectoryPath,
	AbsoluteFilePath,
	AnyDirectoryPath,
	AnyFileOrDirectoryPath,
	FileName,
	RelativeDirectoryPath,
	RelativeFileOrDirectoryPath,
	RelativeFilePath,
	RootPath,
} from "~/types/path";
import { generateUUID } from "~/utils/other";
import { convertPathToString, isAbsolutePath } from "~/utils/path";
import { FileHostFile } from "./file-host-file";

/** Every file host (e.g Mega, MediaFire, etc) must implement this.
 *
 * ** DO NOT CALL THE CONSTRUCTOR DIRECTLY. USE `<Class>.init()` **
 *
 * Terms:
 *  - `.get...()` means the method is local, in the sense that it only looks through cached files
 */
export abstract class FileHost {
	readonly id: FileHostID = generateUUID<FileHostID>();
	dateCreated = new Date();
	abstract readonly type: FILE_HOSTS;

	/** In memory collection of all created file hosts */
	static collection = new ReactiveMap<FileHostID, FileHostImplementations>();

	private static readonly _cacheConfig = {
		maxSize: 100,
		maxAge: 300000,
	} as const;

	constructor(public name: string) {}

	/** **MUST BE IMPLEMENTED IN DERIVED CLASSES BEFOR USE**
	 *
	 * Make sure that the instance is properly initialized before fetching files.
	 */
	// biome-ignore lint: For typescript to be happy
	static init(...args: unknown[]): Promise<FileHostImplementations> {
		throw new Error("Method not implemented! Use derived class");
	}

	static getInstanceFromId(possibleId: string) {
		return FileHost.collection.get(possibleId as FileHostID) ?? null;
	}

	static getRelativePathFromAbsolutePath(
		filePath: AbsoluteDirectoryPath,
	): RelativeDirectoryPath;
	static getRelativePathFromAbsolutePath(
		filePath: AbsoluteFilePath,
	): RelativeFilePath;
	static getRelativePathFromAbsolutePath(
		filePath: AbsoluteFileOrDirectoryPath,
	): RelativeFileOrDirectoryPath {
		return filePath.slice(2);
	}

	getAbsolutePathFromRelativePath(
		filePath: RelativeDirectoryPath,
	): AbsoluteDirectoryPath;
	getAbsolutePathFromRelativePath(filePath: RelativeFilePath): AbsoluteFilePath;
	getAbsolutePathFromRelativePath(
		filePath: RelativeFileOrDirectoryPath,
	): AbsoluteFileOrDirectoryPath {
		return [...this.root(), ...filePath];
	}

	static getFileHostFromAbsolutePath(
		path: AbsoluteFileOrDirectoryPath,
	): FileHostImplementations | null {
		return FileHost.collection.get(path[1]) ?? null;
	}

	static getParentDirectoryFromPath(
		filePath: AbsoluteFileOrDirectoryPath,
	): AbsoluteDirectoryPath | ReturnType<FileHost["root"]>;
	static getParentDirectoryFromPath(
		filePath: RelativeFileOrDirectoryPath,
	): RelativeDirectoryPath | RootPath;
	static getParentDirectoryFromPath(
		filePath: AnyFileOrDirectoryPath,
	): AnyDirectoryPath {
		// Don't go deeper than the "root" in absolute paths
		if (isAbsolutePath(filePath) && filePath.length === 3) {
			return filePath.slice(0, 2);
		}

		return filePath.slice(0, -1);
	}

	/** Deletes the file host from the disk and memory. */
	async deleteInstance(): Promise<void> {
		await hfs.delete(convertPathToString(this.root()));

		FileHost.collection.delete(this.id);
	}

	/** Downloads and caches all files (or only their metadata) from the file host, as `FileHostFile` instances into the file system.
	 */
	abstract downloadFiles(
		/** If `true`, only the bare metadata (like path data, names, sizes) are retrieved, but the file's actual content is not */
		getMetadataOnly?: boolean,
	): Promise<void>;

	/** Sometimes, the url of a file from the file host cannot be directly `fetch`ed (e.g MEGA), so this method does the required procedures and returns the file's blob if successful */
	abstract downloadFileContent(url: URL): Promise<ResultType<Blob>>;

	/** Takes a regular file and the path to upload it to.
	 *
	 * Returns the url to the uploaded file if successful
	 */
	abstract uploadFile(
		file: Blob,
		path: RelativeDirectoryPath,
		/** In case the file's name should be overwritten */
		name: string,
	): Promise<ResultType<URL>>;

	/** Attempts to delete a file from the file host, either permanently or just to the file host's "trash"
	 *
	 * Returns `true` if the file was successfully deleted, `false` otherwise.
	 */
	abstract deleteFile(
		file: RelativeFilePath,
		permanent?: true,
	): Promise<boolean>;

	/** Attempts to delete a folder, and it's content recursively, from the file host, either permanently or just to the file host's "trash"
	 *
	 * Returns `true` if the folder was successfully deleted, `false` otherwise.
	 */
	abstract deleteDirectory(
		directory: RelativeDirectoryPath,
		permanent?: true,
	): Promise<boolean>;

	/** Get's rid of non-existent files (i.e you deleted a file on the file host but it still exists on the client) */
	abstract trimOutdatedCache(): Promise<void>;

	/** Checks if the file exists as a local copy */
	async hasFile(path: AbsoluteFilePath): Promise<boolean> {
		return hfs.isFile(convertPathToString(path));
	}

	/** Retrieves the local copy of the file at the path given, if any */
	async getFile(path: AbsoluteFilePath): Promise<FileHostFile | null> {
		const parsedPath = convertPathToString(path);
		if (!(await hfs.isFile(parsedPath))) return null;

		const possibleFileData = await hfs.bytes(parsedPath);

		if (!possibleFileData) return null;

		return FileHostFile.deserialize(
			possibleFileData,
			this as unknown as FileHostImplementations,
		);
	}

	/** Returns all the files present in the local filesystem */
	async getAllFiles(): Promise<FileHostFile[]> {
		const filePromises: Promise<FileHostFile | null>[] = [];

		for await (const entry of hfs.walk(convertPathToString(this.root()), {
			entryFilter: (entry) => entry.isFile,
		})) {
			filePromises.push(
				this.getFile(
					[this.root(), entry.path.split("/")].flat() as AbsoluteFilePath,
				),
			);
		}

		return (await Promise.all(filePromises)).filter((val) => val != null);
	}

	/** Returns all the directories present in the local filesystem */
	async getAllDirectories(): Promise<DirectoryStats[]> {
		const dirPromises: Promise<DirectoryStats | null>[] = [];
		const root = this.root();

		for await (const entry of hfs.walk(convertPathToString(root), {
			entryFilter: (entry) => entry.isDirectory,
		})) {
			dirPromises.push(
				this.getDirectoryStats(
					[root, entry.path.split("/")].flat() as AbsoluteDirectoryPath,
				),
			);
		}

		return (await Promise.all(dirPromises)).filter((val) => val != null);
	}

	/** Caches the results of `.getDirContents()` */
	private _dirContentCache = new QuickLRU<string, FileOrDirectory[] | null>(
		FileHost._cacheConfig,
	);

	/** Call this in the `.downloadFiles()` or `.trimOutdatedCache()` method of an implementation or whenever changes need to be reflected asap */
	clearDirContentCache(
		...specificRelativePathToClear: RelativeDirectoryPath[]
	) {
		if (specificRelativePathToClear.length) {
			specificRelativePathToClear.forEach((path) =>
				this._dirContentCache.delete(convertPathToString(path)),
			);
		} else {
			// Just clear the entire cache
			this._dirContentCache.clear();
		}
	}

	/** Returns all the files and directories in the directory at the path given.
	 *
	 *  @param path - ensure that the path given to it is relative to the OPFS root
	 * 	@returns `null` if the directory doesn't exist */
	async getDirContents(
		path: Readonly<AbsoluteFilePath>,
	): Promise<[FileHostFile] | null>;
	async getDirContents(
		path: Readonly<AbsoluteDirectoryPath>,
	): Promise<FileOrDirectory[] | null>;
	async getDirContents(
		path: Readonly<AbsoluteFileOrDirectoryPath>,
	): Promise<FileOrDirectory[] | null> {
		const tempResult: FileOrDirectory[] = [];
		const parsedPath = convertPathToString(path);
		const cachedResult = this._dirContentCache.get(parsedPath);

		if (cachedResult !== undefined) return cachedResult;

		if (await hfs.isFile(parsedPath)) {
			const filePath = path as AbsoluteFilePath;
			const possibleFile = await this.getFile(filePath);

			if (possibleFile) return [possibleFile];
		}

		if (await hfs.isDirectory(parsedPath)) {
			/** For concurrently storing the promises */
			const filePromises: Promise<FileHostFile | null>[] = [];
			const dirEntries: FileOrDirectory[] = [];

			for await (const entry of hfs.list(parsedPath)) {
				const { isDirectory, isFile, name: _name } = entry;
				const name = _name as FileName;

				if (isFile) {
					const filePath = [...path, name] as AbsoluteFilePath;
					// Collect all getFile promises without awaiting them immediately
					filePromises.push(this.getFile(filePath));
				} else if (isDirectory) {
					dirEntries.push(
						await this.getDirectoryStats([
							...path,
							name,
						] as AbsoluteDirectoryPath),
					);
				}
			}

			// Await all file promises concurrently
			const fetchedFiles = await Promise.allSettled(filePromises);

			// Process the results of the concurrent fetches
			for (const result of fetchedFiles) {
				if (result.status === "fulfilled" && result.value) {
					tempResult.push(result.value);
				}
			}
			tempResult.push(...dirEntries); // Add the directory entries
		}

		const actualResult = tempResult.length ? tempResult : null;

		this._dirContentCache.set(parsedPath, actualResult);

		return actualResult;
	}

	/** Like `.getDirContents` but recursive :p */
	async getDirContentsRecursively(
		path: Readonly<AbsoluteDirectoryPath>,
	): Promise<FileOrDirectory[] | null> {
		const recursivelyGetDirContents = async (
			currentPath: Readonly<AbsoluteDirectoryPath>,
			accumulatedContents: FileOrDirectory[],
		): Promise<FileOrDirectory[] | null> => {
			const contents = await this.getDirContents(currentPath);

			if (!contents) return accumulatedContents;

			for (const child of contents) {
				if (child instanceof FileHostFile) {
					accumulatedContents.push(child);
				} else {
					accumulatedContents.push(child);
					await recursivelyGetDirContents(child.path, accumulatedContents);
				}
			}

			return accumulatedContents;
		};

		return recursivelyGetDirContents(path, []);
	}

	private _directoryStatsCache = new QuickLRU<string, DirectoryStats>(
		FileHost._cacheConfig,
	);

	/** Call this in the `.downloadFiles()` or `.trimOutdatedCache()` method of an implementation or whenever changes need to be reflected asap */
	clearDirectoryStatsCache(
		...specificRelativePathToClear: RelativeDirectoryPath[]
	) {
		if (specificRelativePathToClear.length) {
			specificRelativePathToClear.forEach((path) =>
				this._directoryStatsCache.delete(convertPathToString(path)),
			);
		} else {
			this._directoryStatsCache.clear();
		}
	}

	/** Returns some metadata about a directory, since they aren't their own classes */
	async getDirectoryStats(
		directoryPath: AbsoluteDirectoryPath,
	): Promise<DirectoryStats> {
		const recursivelyGetDirectoryStats = async (
			directoryPath: Readonly<AbsoluteDirectoryPath>,
			accumulatedStats: DirectoryStats,
		): Promise<DirectoryStats> => {
			const directoryPathString = convertPathToString(directoryPath);
			const cachedStats = this._directoryStatsCache.get(directoryPathString);

			if (cachedStats) return cachedStats;

			const children = await this.getDirContents(directoryPath);

			if (!children) return accumulatedStats;

			for (const child of children) {
				if (child instanceof FileHostFile) {
					accumulatedStats.size += child.size;
					accumulatedStats.fileCount++;
					if (child.dateCreated > accumulatedStats.dateEdited) {
						accumulatedStats.dateEdited = child.dateCreated;
					}
				} else {
					accumulatedStats.folderCount++;
					const childPath: AbsoluteDirectoryPath = [
						...directoryPath,
						child.name,
					];
					accumulatedStats.path = [...directoryPath];
					const childStats = await recursivelyGetDirectoryStats(childPath, {
						...accumulatedStats,
						path: childPath,
					});
					accumulatedStats.size += childStats.size;
					accumulatedStats.fileCount += childStats.fileCount;
					accumulatedStats.folderCount += childStats.folderCount;
					if (childStats.dateEdited > accumulatedStats.dateEdited) {
						accumulatedStats.dateEdited = childStats.dateEdited;
					}
				}
			}

			this._directoryStatsCache.set(directoryPathString, accumulatedStats);

			return accumulatedStats;
		};

		return recursivelyGetDirectoryStats(directoryPath, {
			dateEdited: new Date(0),
			fileCount: 0,
			folderCount: 0,
			name: directoryPath[directoryPath.length - 1],
			path: directoryPath,
			size: 0,
		});
	}

	clearAllCaches() {
		this.clearDirContentCache();
		this.clearDirectoryStatsCache();
	}

	/** Returns the directory that contains all files for the filehost, using it's id.
	 *
	 * If no id is given, the root where all filehosts are stored is returned.
	 *
	 * e.g `/file_host/123po12`
	 */
	static root(): [typeof FILE_HOST_ROOT];
	static root(id: FileHostID): [typeof FILE_HOST_ROOT, FileHostID];
	static root(
		id: FileHostID,
		getSaveLocation: true,
	): [typeof FILE_HOST_ROOT, `${FileHostID}.${typeof DEFAULT_FILE_EXTENSION}`];
	static root(id?: FileHostID, getSaveLocation = false) {
		if (!id) return [FILE_HOST_ROOT];

		return getSaveLocation
			? [FILE_HOST_ROOT, `${id}.${DEFAULT_FILE_EXTENSION}`]
			: [FILE_HOST_ROOT, id];
	}

	/** Returns the directory that contains all files for the filehost.
	 *
	 * e.g `/file_host/123po12`
	 */
	root() {
		return FileHost.root(this.id);
	}

	/** Saves the instance to memory and disk.
	 *
	 * Call this in the static `.init()` method of implementations
	 *
	 * e.g `/file_host/123po12.bin`
	 */
	save() {
		FileHost.collection.set(
			this.id,
			this as unknown as FileHostImplementations,
		);

		return hfs.write(
			convertPathToString(FileHost.root(this.id, true)),
			stringify(this.export()),
		);
	}

	/** Returns a serializable version of the class that the class can be instantiated with `.import()` */
	/** Returns a plain object version of the class */
	abstract export(): unknown;

	// /** Restores data exportd with `.export()` */
	// import(data: ClassPropsOnly<typeof this>) {
	// 	for (const key in data) {
	// 		this[key] = data[key];
	// 	}
	// }

	/** In bytes */
	abstract spaceTotal(): Promise<number>;
	/** In bytes */
	abstract spaceUsed(): Promise<number>;
}
