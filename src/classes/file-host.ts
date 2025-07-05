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

// For `.getDirContents()`
type FileRes = { type: "file"; file: FileHostFile };
type FolderRes = { type: "dir"; name: string };
type FileOrFolderRes = FileRes | FolderRes;

const FILE_HOST = "file_host";
const DEFAULT_FILE_EXTENSION = "bin";

/** Every file host (e.g Mega, MediaFire, etc) must implement this */
export abstract class FileHost {
	readonly id: FileHostID = generateUUID<FileHostID>();
	dateCreated = new Date();
	abstract readonly type: gFileHosts;

	/** In memory collection of all created file hosts */
	static collection = new ReactiveMap<FileHostID, FileHostImplementations>();

	constructor(public name: string) {}

	/** **MUST BE IMPLEMENTED IN DERIVED CLASSES BEFOR USE**
	 *
	 * Make sure that the instance is properly initialized before fetching files.
	 */
	static init(...args: unknown[]): Promise<FileHostImplementations> {
		throw new Error("Method not implemented! Use derived class");
	}

	/** Downloads and caches all files (or only their metadata) from the file host into the file system */
	abstract downloadFiles(
		/** If `true`, only the bare metadata (like path data, names, sizes) are retrieved, but the file's actual content is not */
		getMetadataOnly?: boolean,
	): Promise<void>;

	/** Sometimes, the url of a file from the file host cannot be directly `fetch`ed (e.g MEGA), so this method does the required procedures and returns the file's blob if successful */
	abstract downloadFile(url: URL): Promise<ResultType<Blob>>;

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

	async hasFile(path: FilePath): Promise<boolean> {
		return hfs.isFile(convertPathToString(path));
	}

	/**  */
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

	/** Caches the results of `.getDirContents()` */
	private static _dirContentCache = new QuickLRU<string, FileOrFolderRes[]>({
		maxSize: 20,
		maxAge: 30000,
	});

	/** Ensure that the path given to it is realteive to the OPFS root
	 *
	 * 	@returns `null` if the directory doesn't exist */
	async getDirContents(path: FilePath): Promise<[FileRes] | null>;
	async getDirContents(path: DirectoryPath): Promise<FileOrFolderRes[] | null>;
	async getDirContents(
		path: FileOrDirectoryPath,
	): Promise<FileOrFolderRes[] | null> {
		const res: FileOrFolderRes[] = [];
		const parsedPath = convertPathToString(path);
		const cachedResult = FileHost._dirContentCache.get(parsedPath);

		if (cachedResult) return cachedResult;

		if (await hfs.isFile(parsedPath)) {
			const filePath = path as FilePath;
			const possibleFile = await this.getFile(filePath);

			if (possibleFile) return [{ type: "file", file: possibleFile }];
		}

		if (await hfs.isDirectory(parsedPath)) {
			for await (const entry of hfs.list(parsedPath)) {
				const { isDirectory, isFile, name: _name } = entry;
				const name = _name as FileName;

				if (isFile) {
					const filePath = [...path, name] as FilePath;

					const possibleFile = await this.getFile(filePath);
					if (possibleFile) res.push({ file: possibleFile, type: "file" });
				} else if (isDirectory) {
					res.push({ name, type: "dir" });
				}
			}
		}

		if (res.length) {
			FileHost._dirContentCache.set(parsedPath, res);
			return res;
		}

		return null;
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
			JSON.stringify(this.export()),
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
			const props: FileHostClassProps = await hfs.json(
				convertPathToString(fileHostRoot(fileHostId)),
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
	readonly path: FilePath;
	readonly dateCreated: Date;
	dateEdited = new Date();
	private readonly _url: URL;
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
		} = args;

		const [name, ext] = argName.split(/\.(?!.*\.)/);
		this._name = name;
		this._ext = ext;
		this._url = new URL(fileUrl);
		this._fileHostId = fileHostId;
		this._file = fileData ?? null;
		this.dateCreated = dateCreated ?? new Date();

		this.path = [
			...(this.fileHost?.root() ?? []),
			...relativePath,
			this.name(true),
		];

		// TODO - Determine file type without necessarily downloading the entire file
		// const { _file } = this;
	}

	name(): string;
	name(includeExtension: false): string;
	name(includeExtension: true): FileName;
	name(includeExtension = false): string {
		return includeExtension ? `${this._name}.${this._ext}` : this._name;
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

	async file(
		/** If true, the file is always fetched from the file host */
		forceDownload = false,
	): Promise<Blob> {
		if (this._file && !forceDownload) return this._file;
		else {
			const fileHost = this.fileHost;

			// Use the file host's implementation if present and successful, otherwise, fall back to a generic fetch
			try {
				if (fileHost) {
					const res = await fileHost.downloadFile(this._url);

					if (res.state === "error")
						throw `Failed to fetch file from ${fileHost.name}`;

					const { result } = res;
					this._file = result;
					this.saveToDisk();
					return result;
				} else {
					throw new Error("No filehost found. Falling back to default fetch");
				}
			} catch {
				const blob = await (await fetch(this._url)).blob();
				const file = new File([blob], this.name(true));
				this._file = file;
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

	/** ALWAYS USE THIS TO GET THE CLASS */
	static async init(...args: ConstructorParameters<typeof FileHostFile>) {
		const newClass = new FileHostFile(...args);
		const parentFileHost = newClass.fileHost;

		await newClass._cacheMimeType();

		if (parentFileHost) {
			// Store the file in the filesystem.
			await newClass.saveToDisk();
		}

		console.log(newClass);

		return newClass;
	}
}
