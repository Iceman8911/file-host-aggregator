import { hfs } from "@humanfs/web";
import { ReactiveMap } from "@solid-primitives/map";
import { stringify } from "@worker-tools/structured-json";
import {
	DEFAULT_FILE_HOST_EXTENSION,
	FILE_HOST_ROOT,
} from "~/shared/constants";
import type { FILE_HOSTS } from "~/shared/enums";
import type {
	DirectoryStats,
	ReadonlyDirectoryStats,
} from "~/types/file-directory-file-host/directory";
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
	RelativeDirectoryPath,
	RelativeFileOrDirectoryPath,
	RelativeFilePath,
} from "~/types/path";
import { directoryCacheService } from "~/utils/file-directory-file-host/cache";
import { generateUUID } from "~/utils/other";
import {
	convertPathToString,
	convertStringToPath,
	getDirectParentOfPath,
	getNameFromPath,
	isAbsolutePath,
	isFilePath,
} from "~/utils/path";
import { FileHostFile } from "./file-host-file";

// type ReadonlyFileHostFile = Readonly<FileHostFile>;
type NullishReadonlyFileHostFile = Readonly<FileHostFile | null>;

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

	private static readonly _cacheConfig = {
		maxSize: 100,
		maxAge: 300000,
	} as const;

	/** In memory collection of all created file hosts */
	static collection = new ReactiveMap<FileHostID, FileHostImplementations>();

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
		filePath: AbsoluteFilePath,
	): RelativeFilePath;
	static getRelativePathFromAbsolutePath(
		filePath: AbsoluteDirectoryPath,
	): RelativeDirectoryPath;
	static getRelativePathFromAbsolutePath(
		filePath: AbsoluteFileOrDirectoryPath,
	): RelativeFileOrDirectoryPath {
		return filePath.slice(2);
	}

	getAbsolutePathFromRelativePath(filePath: RelativeFilePath): AbsoluteFilePath;
	getAbsolutePathFromRelativePath(
		filePath: RelativeDirectoryPath,
	): AbsoluteDirectoryPath;
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
	): RelativeDirectoryPath;
	static getParentDirectoryFromPath(
		filePath: AnyFileOrDirectoryPath,
	): AnyDirectoryPath {
		// Don't go deeper than the "root" in absolute paths
		if (isAbsolutePath(filePath) && filePath.length === 3) {
			return filePath.slice(0, 2);
		}

		return filePath.slice(0, -1);
	}

	/** Deletes the file host and all it's contents from the disk and memory.
	 *
	 * TODO: Integrate cache clearing
	 */
	async deleteInstance(): Promise<void> {
		FileHost.collection.delete(this.id);

		await Promise.allSettled([
			hfs.delete(convertPathToString(FileHost.root(this.id, true))),
			hfs.deleteAll(convertPathToString(this.root())),
		]);
	}

	/** Downloads and caches all files (or only their metadata) from the file host, as `FileHostFile` instances into the file system.
	 */
	abstract downloadFiles(
		/** If `true`, only the bare metadata (like path data, names, sizes) are retrieved, but the file's actual content is not */
		getMetadataOnly?: boolean,
	): Promise<void>;

	/** Sometimes, the url of a file from the file host cannot be directly `fetch`ed (e.g MEGA), so this method does the required procedures and returns the file's blob if successful */
	abstract downloadFileContent(url: URL): Promise<ResultType<Blob>>;

	/** Takes a regular file and the path to upload it to. If successful, a local copy is also created
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

	// /** Checks if the file exists as a local copy */
	// async hasFile(path: AbsoluteFilePath): Promise<boolean> {
	// 	return !!(await this.getFile(path));
	// }

	/** Retrieves the local copy of the file at the path given, if any */
	async getFile(path: AbsoluteFilePath): Promise<NullishReadonlyFileHostFile> {
		return FileHostFile.getInstance(path);
	}

	/** Returns all the files present in the local filesystem */
	async *getAllFiles(): AsyncGenerator<FileHostFile> {
		for await (const entry of directoryCacheService.getDescendants(
			this.root(),
		)) {
			if (entry.type === "file") {
				const nullishFile = await this.getFile(convertStringToPath(entry.path));

				if (nullishFile) yield nullishFile;
			}
		}
	}

	/** Returns all the stats of directories present in the local filesystem */
	async *getAllDirectories(): AsyncGenerator<ReadonlyDirectoryStats> {
		for await (const entry of directoryCacheService.getDescendants(
			this.root(),
		)) {
			if (entry.type === "dir") {
				yield this.getDirectoryStats(convertStringToPath(entry.path));
			}
		}
	}

	/** Returns all the files and **directory stats** in the directory at the path given.
	 *
	 *  @param path - ensure that the path given to it is absolute to the OPFS root
	 * 	@returns `null` if the directory doesn't exist */
	async scanDirectory(
		path: Readonly<AbsoluteDirectoryPath>,
	): Promise<ReadonlyArray<FileOrDirectory>> {
		const directoryPaths = await directoryCacheService.getChildren(path);

		const fileOrDirectoryPromises = directoryPaths.reduce<
			Array<Promise<FileOrDirectory | null>>
		>((acc, val) => {
			if (val.type === "file") {
				const filePath = convertStringToPath(val.path);

				// Collect all promises without awaiting them immediately
				acc.push(this.getFile(filePath));
			} else {
				const directoryPath = convertStringToPath(val.path);

				// Collect all promises without awaiting them immediately
				acc.push(this.getDirectoryStats(directoryPath));
			}

			return acc;
		}, []);

		const val = (await Promise.allSettled(fileOrDirectoryPromises)).reduce<
			FileOrDirectory[]
		>((acc, val) => {
			if (val.status === "fulfilled" && val.value) {
				acc.push(val.value);
			}

			return acc;
		}, []);

		return val;
	}

	/** Returns a generator of all child and descendant files in the given directory path. **NO DIRECTORIES** */
	async *scanDirectoryForDescendantFiles(
		path: Readonly<AbsoluteDirectoryPath>,
	): AsyncGenerator<FileHostFile> {
		const descendants = directoryCacheService.getDescendants(path);

		for await (const entry of descendants) {
			if (entry.type === "file") {
				const file = await this.getFile(convertStringToPath(entry.path));

				if (file) yield file;
			}
		}
	}

	/** Returns some metadata about a directory, since they aren't their own classes */
	async getDirectoryStats(
		directoryPath: AbsoluteDirectoryPath,
	): Promise<ReadonlyDirectoryStats> {
		return directoryCacheService.getStats(directoryPath);
	}

	/** Returns the directory that contains all files for the filehost, using it's id.
	 *
	 * If no id is given, the root where all filehosts are stored is returned.
	 *
	 * e.g `/file_host/123po12`
	 */
	static root(): readonly [typeof FILE_HOST_ROOT];
	static root(id: FileHostID): readonly [typeof FILE_HOST_ROOT, FileHostID];
	static root(
		id: FileHostID,
		getSaveLocation: true,
	): readonly [
		typeof FILE_HOST_ROOT,
		`${FileHostID}.${typeof DEFAULT_FILE_HOST_EXTENSION}`,
	];
	static root(id?: FileHostID, getSaveLocation = false) {
		if (!id) return [FILE_HOST_ROOT] as const;

		return getSaveLocation
			? ([FILE_HOST_ROOT, `${id}.${DEFAULT_FILE_HOST_EXTENSION}`] as const)
			: ([FILE_HOST_ROOT, id] as const);
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

	protected async _deleteLocalFileOrDirectory(
		fileOrDirectoryPath: AbsoluteFileOrDirectoryPath,
	) {
		if (isFilePath(fileOrDirectoryPath)) {
			await (
				await this.getFile(
					this.getAbsolutePathFromRelativePath(fileOrDirectoryPath),
				)
			)?.delete();
		} else {
			const directoryPathString = convertPathToString(fileOrDirectoryPath);

			await hfs.deleteAll(directoryPathString);

			directoryCacheService.clearCache(
				getDirectParentOfPath(fileOrDirectoryPath),
			);
		}
	}
}
