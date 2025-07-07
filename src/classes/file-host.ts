import { hfs } from "@humanfs/web";
import { ReactiveMap } from "@solid-primitives/map";
import {
	parse,
	stringify,
	stringifyAsync,
} from "@worker-tools/structured-json";
import { signalify } from "classy-solid";
import QuickLRU from "quick-lru";
import { gFileHosts } from "~/declarations/enums";
import { convertPathToString, generateUUID } from "~/declarations/functions";
import type {
	Brand,
	ClassPropsOnly,
	DirectoryPath,
	FileName,
	FileOrDirectoryPath,
	FilePath,
	ResultType,
	UUID,
} from "~/declarations/types";
import { DEFAULT_FILE_NAME, ROOT_PATH } from "~/declarations/variables";
import type { MegaSyncFileHost } from "./mega-sync";

export type FileHostID = Brand<UUID, "FileHostID">;
export type FileHostImplementations = MegaSyncFileHost;
export type FileHostClassProps = ReturnType<FileHostImplementations["export"]>;

export type FolderStats = {
	/** In bytes */
	size: number;
	/** The value of this is the same as the creation date of it's most recent descendant file or folder (recursive) */
	dateEdited: Date;
	/** Number of descendant files */
	fileCount: number;
	/** Number of descendant folders */
	folderCount: number;
	/** The path to the folder */
	path: DirectoryPath;
	/** The name of the folder */
	name: string;
};

export type FileOrDirectoryOrFileHost =
	| FileHostFile
	| FileHostImplementations
	| FolderStats;

export type FileOrDirectory = FileHostFile | FolderStats;

const FILE_HOST = "file_host";
const DEFAULT_FILE_EXTENSION = "bin";

/** Every file host (e.g Mega, MediaFire, etc) must implement this
 *
 * Terms:
 *  - `.get...()` means the method is local, in the sense that it only looks through cached files
 */
export abstract class FileHost {
	readonly id: FileHostID = generateUUID<FileHostID>();
	dateCreated = new Date();
	abstract readonly type: gFileHosts;

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
	static init(...args: unknown[]): Promise<FileHostImplementations> {
		throw new Error("Method not implemented! Use derived class");
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
		path: DirectoryPath,
		/** In case the file's name should be overwritten */
		name: string,
	): Promise<ResultType<URL>>;

	/** Attempts to delete a file from the file host */
	abstract deleteFile(file: FilePath): ResultType<never>;

	/** Get's rid of non-existent files (i.e you deleted a file on the file host but it still exists on the client) */
	abstract trimOutdatedCache(): Promise<void>;

	/** Checks if the file exists as a local copy */
	async hasFile(path: FilePath): Promise<boolean> {
		return hfs.isFile(convertPathToString(path));
	}

	/** Retrieves the local copy of the file at the path given, if any */
	async getFile(path: FilePath): Promise<FileHostFile | null> {
		const parsedPath = convertPathToString(path);
		if (!(await hfs.isFile(parsedPath))) return null;

		const possibleFileData = await hfs.text(parsedPath);

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
				this.getFile([this.root(), entry.path.split("/")].flat() as FilePath),
			);
		}

		return (await Promise.all(filePromises)).filter((val) => val != null);
	}

	/** Caches the results of `.getDirContents()` */
	private _dirContentCache = new QuickLRU<string, FileOrDirectory[] | null>(
		FileHost._cacheConfig,
	);

	/** Call this in the `.downloadFiles()` or `.trimOutdatedCache()` method of an implementation or whenever changes need to be reflected asap */
	clearDirContentCache() {
		this._dirContentCache.clear();
	}

	/**
	 *  @param path - ensure that the path given to it is relative to the OPFS root
	 * 	@returns `null` if the directory doesn't exist */
	async getDirContents(
		path: Readonly<FilePath>,
	): Promise<[FileHostFile] | null>;
	async getDirContents(
		path: Readonly<DirectoryPath>,
	): Promise<FileOrDirectory[] | null>;
	async getDirContents(
		path: Readonly<FileOrDirectoryPath>,
	): Promise<FileOrDirectory[] | null> {
		const tempResult: FileOrDirectory[] = [];
		const parsedPath = convertPathToString(path);
		const cachedResult = this._dirContentCache.get(parsedPath);

		if (cachedResult !== undefined) return cachedResult;

		if (await hfs.isFile(parsedPath)) {
			const filePath = path as FilePath;
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
					const filePath = [...path, name] as FilePath;
					// Collect all getFile promises without awaiting them immediately
					filePromises.push(this.getFile(filePath));
				} else if (isDirectory) {
					dirEntries.push({
						dateEdited: new Date(0),
						fileCount: 0,
						folderCount: 0,
						name,
						path: [...path, name] as DirectoryPath,
						size: 0,
					});
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

	private _folderStatsCache = new QuickLRU<string, FolderStats>(
		FileHost._cacheConfig,
	);

	/** Call this in the `.downloadFiles()` or `.trimOutdatedCache()` method of an implementation or whenever changes need to be reflected asap */
	clearFolderStatsCache() {
		this._folderStatsCache.clear();
	}

	async getFolderStats(directoryPath: DirectoryPath): Promise<FolderStats> {
		const recursivelyGetFolderStats = async (
			directoryPath: Readonly<DirectoryPath>,
			accumulatedStats: FolderStats,
		): Promise<FolderStats> => {
			const directoryPathString = convertPathToString(directoryPath);
			const cachedStats = this._folderStatsCache.get(directoryPathString);

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
					const childPath = [...directoryPath, child.name] as DirectoryPath;
					const childStats = await recursivelyGetFolderStats(childPath, {
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

			this._folderStatsCache.set(directoryPathString, accumulatedStats);

			return accumulatedStats;
		};

		return recursivelyGetFolderStats(directoryPath, {
			dateEdited: new Date(0),
			fileCount: 0,
			folderCount: 0,
			name: directoryPath[directoryPath.length - 1],
			path: ROOT_PATH,
			size: 0,
		});
	}

	clearAllCaches() {
		this.clearDirContentCache();
		this.clearFolderStatsCache();
	}

	/** Returns the directory that contains all files for the filehost, using it's id.
	 *
	 * If no id is given, the root where all filehosts are stored is returned.
	 *
	 * e.g `/file_host/123po12`
	 */
	static root(): [typeof FILE_HOST];
	static root(id: FileHostID): [typeof FILE_HOST, FileHostID];
	static root(
		id: FileHostID,
		getSaveLocation: true,
	): [typeof FILE_HOST, `${FileHostID}.${typeof DEFAULT_FILE_EXTENSION}`];
	static root(id?: FileHostID, getSaveLocation = false) {
		if (!id) return [FILE_HOST];

		return getSaveLocation
			? [FILE_HOST, `${id}.${DEFAULT_FILE_EXTENSION}`]
			: [FILE_HOST, id];
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

/** Initializes all stored file hosts and returns an array of them as result */
export async function initFileHosts(): Promise<
	ReadonlyArray<FileHostImplementations>
> {
	const fileHosts: Array<FileHostImplementations> = [];
	const { root: fileHostRoot } = FileHost;

	// Load all file hosts from the disk
	for await (const entry of hfs.list(convertPathToString(fileHostRoot()))) {
		const { isFile, name } = entry;

		if (name.endsWith(".bin") && isFile) {
			const fileHostId = name as FileHostID;
			const props: FileHostClassProps = parse(
				(await hfs.text(convertPathToString(fileHostRoot(fileHostId)))) ?? "",
			);
			const { type } = props;

			// TODO: Depending on the `.type`, instantiate the appropriate class
			switch (type) {
				case gFileHosts.MEGA: {
					const { MegaSyncFileHost } = await import("./mega-sync");
					const instance = await MegaSyncFileHost.init({
						...props,
						restore: true,
					});
					if (instance) fileHosts.push(instance);
					break;
				}
			}
		}
	}

	return fileHosts;
}

/** Categories for the type of a file.
 *
 * Like all "png", "jpg", "webp", etc files are `FileType.IMAGE`
 */
export enum FileType {
	TEXT = "txt",
	IMAGE = "img",
	VIDEO = "vid",
	AUDIO = "aud",
	ARCHIVE = "zip",

	PDF = "pdf",
	EPUB = "epub",
	/** Generic text document stored in a binary format, e.g `.docx`, `.xlsx`,etc */
	DOCUMENT = "doc",
	OTHER = "bin",
}

/** A representation of a file fetched from a file-host. At first, it only contains the bare metadata but not the actual file. When interacted with, the actual file will be downloaded */
export class FileHostFile {
	/** The name of the file, without the extension */
	private _name: string;
	/** The extension of the file, e.g `webp`, `7z`, etc */
	private _ext: string;
	/** Absolute path from the root of the OPFS */
	readonly path: FilePath;
	readonly dateCreated: Date;
	/** In bytes */
	size: number;
	// UNUSED
	dateEdited = new Date();
	readonly url: URL;
	/** image string, could be a url, or raw base64 data */
	private _thumbnail: string | null = null;
	private _file: Blob | null = null;
	/** Cache for the file's mimetype  */
	private _mimeType: string | null = null;
	private _fileHostId: FileHostID;

	constructor(args: {
		name: string;
		relativePath: DirectoryPath;
		fileUrl: URL | string;
		fileHostId: FileHostID;
		dateCreated?: Date;
		size?: number;
		/** In cases where it's convenient enough to get the file data */
		fileData?: Blob;
	}) {
		const {
			dateCreated,
			fileData,
			fileHostId,
			fileUrl,
			name: argName,
			relativePath,
			size,
		} = args;

		const [name, ext] = argName.split(/\.(?!.*\.)/);
		this._name = name;
		this._ext = ext;
		this.url = new URL(fileUrl);
		this._fileHostId = fileHostId;
		this._file = fileData ?? null;
		this.dateCreated = dateCreated ?? new Date();
		this.size = size ?? 0;

		this.path = [
			...(this.fileHost?.root() ?? []),
			...relativePath,
			this.name(true),
		];
	}

	name(): string;
	name(includeExtension: false): string;
	name(includeExtension: true): FileName;
	name(includeExtension = false): string {
		return includeExtension ? `${this._name}.${this._ext}` : this._name;
	}

	/** The file's path relative to it's file host */
	get relativePath(): FilePath {
		const fileHostSet = new Set<string>(this.fileHost?.root() ?? []);

		return this.path.filter(
			(pathFragment) => !fileHostSet.has(pathFragment),
		) as FilePath;
	}

	// If the actual thumbnail for the file cannot be obtained, fall back to default placeholders
	thumbnail(): Exclude<typeof this._thumbnail, undefined> {
		if (this._thumbnail) return this._thumbnail;

		// TODO: Use placeholders
		switch (this.type) {
			case FileType.TEXT:
				return "";
			case FileType.IMAGE:
				return "";
			case FileType.VIDEO:
				return "";
			case FileType.AUDIO:
				return "";
			case FileType.ARCHIVE:
				return "";
			case FileType.PDF:
				return "";
			case FileType.EPUB:
				return "";
			case FileType.DOCUMENT:
				return "";
			case FileType.OTHER:
				return "";
		}

		return "";
	}

	/** Fetches and stores the actual content the instance represents. */
	async getFile(
		/** If true, the file is always fetched from the file host */
		forceDownload = false,
	): Promise<Blob> {
		if (this._file && !forceDownload) return this._file;
		else {
			const fileHost = this.fileHost;

			// Use the file host's implementation if present and successful, otherwise, fall back to a generic fetch
			try {
				if (fileHost) {
					const res = await fileHost.downloadFileContent(this.url);

					if (res.state === "error")
						throw Error(`Failed to fetch file from ${fileHost.name}`);

					const { result } = res;
					this._file = result;
					this.size = result.size;
					this.saveToDisk();
					return result;
				} else {
					throw Error("No filehost found. Falling back to default fetch");
				}
			} catch {
				const blob = await (await fetch(this.url)).blob();
				const file = new File([blob], this.name(true));
				this._file = file;
				this.size = file.size;
				this.saveToDisk();

				return file;
			}
		}
	}

	get type(): FileType {
		const { _mimeType } = this;

		if (!_mimeType) return FileType.OTHER;

		const includes = (arg: string) => _mimeType.includes(arg);

		return includes("text")
			? FileType.TEXT
			: includes("image")
				? FileType.IMAGE
				: includes("application/pdf")
					? FileType.PDF
					: includes("application/epub")
						? FileType.EPUB
						: includes("video")
							? FileType.VIDEO
							: includes("audio")
								? FileType.AUDIO
								: includes("application/zip")
									? FileType.ARCHIVE
									: includes("vnd") || includes("ms")
										? FileType.DOCUMENT
										: FileType.OTHER;
	}

	/** Caches the mime type (since `lookup()` is a server function) */
	private async _cacheMimeType() {
		const { _file, _ext } = this;
		const { mime } = await import("./mime");
		const mimeType =
			_file?.type ?? mime.getType(_ext) ?? "application/octet-stream";

		this._mimeType = mimeType;
		// console.log(mimeType)

		return mimeType;
	}

	get fileHost(): FileHostImplementations | null {
		return FileHost.collection.get(this._fileHostId) ?? null;
	}

	// TODO: Add string compression. Maybe we can apply it conditionally depending on the blob size
	static async serialize(instance: FileHostFile) {
		const shouldSerializeAsync = !!Object.values(instance).find(
			(val: unknown) => {
				return val instanceof Blob;
			},
		);

		return shouldSerializeAsync
			? stringifyAsync(instance)
			: stringify(instance);
	}

	async saveToDisk() {
		// console.log(
		// 	"The Path of ",
		// 	this.name(true),
		// 	"is:",
		// 	this.path,
		// 	"\n As for if it has a parent, you can find it in:",
		// 	{ ...this.fileHost },
		// );
		return hfs.write(
			convertPathToString(this.path),
			await FileHostFile.serialize(this),
		);
	}

	static async deserialize(
		data: string,
		fileHostParent: FileHostImplementations,
	) {
		const deserializedData: FileHostFile = await parse(data);
		const newClass = new FileHostFile({
			fileHostId: fileHostParent.id,
			fileUrl: window.location.href,
			name: DEFAULT_FILE_NAME,
			relativePath: ROOT_PATH,
		});

		for (const key in deserializedData) {
			//@ts-expect-error
			newClass[key] = deserializedData[key];
		}

		// Save the changes we made
		await newClass.saveToDisk();

		return newClass;
	}

	/** **ALWAYS USE THIS TO GET THE CLASS**
	 *
	 * Trying to initialize a new instance, while previous data for a previous instance with the same file name exists, the new instance will not override the old one **UNLESS** the new instance is newer
	 */
	static async init(...args: ConstructorParameters<typeof FileHostFile>) {
		const instance = new FileHostFile(...args);

		const localCopy = await instance.fileHost?.getFile(instance.path);

		// Only use the new instance if there is no local copy or if it's newer
		if (!localCopy || instance.dateCreated > localCopy.dateCreated) {
			await instance._cacheMimeType();
			await instance.saveToDisk();
			return instance;
		}

		return localCopy;
	}
}
