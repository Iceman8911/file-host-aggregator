import { hfs } from "@humanfs/web";
import { parse, stringify } from "@worker-tools/structured-json";
import QuickLRU from "quick-lru";
import { FILE_ITERATOR_IGNORE_SUFFIX } from "~/shared/constants";
import { FILE_TYPE } from "~/shared/enums";
import type { FileHostImplementations } from "~/types/file-directory-file-host/file-host";
import type {
	AbsoluteDirectoryPath,
	AbsoluteFilePath,
	AbsoluteFilePathString,
	FileName,
	RelativeDirectoryPath,
	RelativeFilePath,
} from "~/types/path";
import {
	directoryCacheService,
	fileCacheService,
	fileContentCacheService,
} from "~/utils/file-directory-file-host/cache";
import { getExtensionFromFileName } from "~/utils/file-name";
import { gIsUserConnectedToInternet } from "~/utils/internet";
import { downloadBlobToDisk } from "~/utils/other";
import { convertPathToString, getDirectParentOfPath } from "~/utils/path";
import { FileHost } from "./file-host";

const { mime } = await import("./mime");

type FileHostFileMetadataProps = {
	/** Contains the file name and extension */
	readonly name: FileName;

	/** For the actual file's creation, not this instance's */
	readonly dateCreated: Date;

	/** Absolute path from the root of the OPFS */
	readonly absolutePath: AbsoluteFilePath;

	/** In bytes */
	readonly size: number;

	readonly url: URL;
};

/** Lightweight representation of a file from the file host. It strictly contains all essential data about the file bar it's content.
 */
class FileHostFileMetadata implements FileHostFileMetadataProps {
	readonly name: FileName;

	readonly dateCreated: Date;

	readonly absolutePath: AbsoluteFilePath;

	readonly size: number;

	readonly url: URL;

	constructor(arg: FileHostFileMetadataProps) {
		this.name = arg.name;
		this.dateCreated = arg.dateCreated;
		this.absolutePath = arg.absolutePath;
		this.size = arg.size;
		this.url = arg.url;
	}

	/** File extension from the file name */
	get ext(): string {
		return getExtensionFromFileName(this.name);
	}

	get mimeType(): string {
		return mime.getType(this.ext) ?? "application/octet-stream";
	}

	/** Relative path from the file host in specific.
	 *
	 * Maps to the real path on the file host
	 */
	get relativePath(): RelativeFilePath {
		return FileHost.getRelativePathFromAbsolutePath(this.absolutePath);
	}

	/** Path to the immediate parent directory */
	get directoryPath(): {
		absolute: AbsoluteDirectoryPath;
		relative: RelativeDirectoryPath;
	} {
		return {
			absolute: FileHost.getParentDirectoryFromPath(this.absolutePath),
			relative: FileHost.getParentDirectoryFromPath(this.relativePath),
		};
	}

	/** In memory file host class that this file belongs to */
	get fileHost(): FileHostImplementations | null {
		return FileHost.getFileHostFromAbsolutePath(this.absolutePath);
	}

	get type(): FILE_TYPE {
		if (!this.mimeType) return FILE_TYPE.OTHER;

		const includes = (arg: string) => this.mimeType.includes(arg);

		return includes("text")
			? FILE_TYPE.TEXT
			: includes("image")
				? FILE_TYPE.IMAGE
				: includes("application/pdf")
					? FILE_TYPE.PDF
					: includes("application/epub")
						? FILE_TYPE.EPUB
						: includes("video")
							? FILE_TYPE.VIDEO
							: includes("audio")
								? FILE_TYPE.AUDIO
								: includes("application/zip")
									? FILE_TYPE.ARCHIVE
									: includes("vnd") || includes("ms")
										? FILE_TYPE.DOCUMENT
										: FILE_TYPE.OTHER;
	}

	/** Deletes any saved metadata about this instance */
	async delete(): Promise<boolean> {
		const deleteResult = await hfs.delete(
			convertPathToString(this.absolutePath),
		);

		directoryCacheService.clearCache(getDirectParentOfPath(this.absolutePath));

		return deleteResult;
	}

	private _serialize(): Readonly<string> {
		return stringify({ ...this });
	}

	async saveToDisk(): Promise<void> {
		await hfs.write(convertPathToString(this.absolutePath), this._serialize());

		directoryCacheService.clearCache(getDirectParentOfPath(this.absolutePath));
	}

	private static _deserialize(
		serializedString: string,
	): Readonly<FileHostFileMetadata> {
		try {
			const data: FileHostFileMetadataProps = parse(serializedString);
			const { absolutePath, dateCreated, name, size, url } = data;

			return Object.assign(
				new FileHostFileMetadata({
					absolutePath,
					dateCreated,
					name,
					size,
					url,
				}),
				data,
			);
		} catch {
			throw "Invalid Serialized Data";
		}
	}

	static async loadFromDisk(
		path: AbsoluteFilePath,
	): Promise<Readonly<FileHostFileMetadata | null>> {
		const serializedData = await hfs.text(convertPathToString(path));

		if (serializedData) {
			return FileHostFileMetadata._deserialize(serializedData);
		} else {
			return null;
		}
	}

	/** Initializes the class and saves the data to disk */
	static async init(
		arg: FileHostFileMetadataProps,
	): Promise<Readonly<FileHostFileMetadata>> {
		const instance = new FileHostFileMetadata(arg);

		await instance.saveToDisk();

		return instance;
	}
}

type ReadonlyFileHostFile = Readonly<FileHostFile>;
type NullishReadonlyFileHostFile = Readonly<FileHostFile | null>;

/** Wrapper class that exposes file metadata and content, with extra utilities.
 *
 * This class is not serialized by itself, just it's metadata and associated blob content
 *
 * Do not intialize this directly. Use the static `.init()` method.
 */
export class FileHostFile {
	constructor(readonly metadata: Readonly<FileHostFileMetadata>) {}

	/** This returns an already existing instance of the class, either from the cache, or the disk
	 *
	 * You should always be using this if you require a previously created instance externally
	 */
	static async getInstance(
		path: AbsoluteFilePath,
	): Promise<NullishReadonlyFileHostFile> {
		return fileCacheService.get(path);
	}

	/** Use this to initialize a new instance
	 *
	 * Tries to initialize a new instance, while previous data for a previous instance with the same file name exists, the new instance will not override the old one **UNLESS** the new instance is newer
	 *
	 */
	static async init(
		metadataArgs: ConstructorParameters<typeof FileHostFileMetadata>,
		blobData?: Blob,
	): Promise<ReadonlyFileHostFile> {
		const createdClass = new FileHostFile(
			await FileHostFileMetadata.init(...metadataArgs),
		);

		const createdClassAbsolutePath = createdClass.metadata.absolutePath;

		const existingClassIfAny = await FileHostFile.getInstance(
			createdClassAbsolutePath,
		);

		if (
			!existingClassIfAny ||
			createdClass.metadata.dateCreated >
				existingClassIfAny.metadata.dateCreated
		) {
			fileCacheService.set(createdClass);

			if (blobData) {
				fileContentCacheService.set(createdClassAbsolutePath, blobData);
			}

			return createdClass;
		}

		return existingClassIfAny;
	}

	/** Load up a single instance (if any) based off the absolute path in the opfs */
	static async loadFromDisk(
		path: AbsoluteFilePath,
	): Promise<NullishReadonlyFileHostFile> {
		const restoredMetadata = await FileHostFileMetadata.loadFromDisk(path);

		if (restoredMetadata) {
			// Create instance directly instead of calling init() to avoid circular reference
			const instance = new FileHostFile(restoredMetadata);

			// Add to cache directly since we're loading from disk
			fileCacheService.set(instance);

			return instance;
		} else {
			return null;
		}
	}

	/** Returns the file content (if any)
	 *
	 * @param [forceRefresh=false] If true, an updated file is requested from the server if an internet connection is available, otherwise, the cache is used
	 */
	async getBlob(forceRefresh = false): Promise<Readonly<Blob | null>> {
		const cachedBlob = await fileContentCacheService.get(
			this.metadata.absolutePath,
		);

		if (!cachedBlob || forceRefresh) {
			if (!(await gIsUserConnectedToInternet())) return null;

			const result = await this.metadata.fileHost?.downloadFileContent(
				this.metadata.url,
			);

			if (result?.state === "success") {
				const fetchedBlob = result.result;

				return fileContentCacheService.set(
					this.metadata.absolutePath,
					fetchedBlob,
				);
			} else {
				return null;
			}
		} else {
			return cachedBlob;
		}
	}

	/** Basically `.getBlob()` and then the result is downloaded */
	async downloadFileToDisk(useLatestFromFileHost = false) {
		const blob = await this.getBlob(useLatestFromFileHost);

		if (blob) {
			downloadBlobToDisk(blob, this.metadata.name);
		}
	}

	/** Removes this instance from memory and storage locally */
	async delete() {
		const absolutePath = this.metadata.absolutePath;

		fileCacheService.delete(absolutePath);

		await this.metadata.delete();

		await fileContentCacheService.delete(absolutePath);
	}

	/** Returns a base64 representation of a thumbnail, if any */
	async thumbnail(): Promise<string | null> {
		// if (this._thumbnail) return this._thumbnail;

		// TODO: Use placeholders
		// switch (this.type) {
		// 	case FILE_TYPE.TEXT:
		// 		return "";
		// 	case FILE_TYPE.IMAGE:
		// 		return "";
		// 	case FILE_TYPE.VIDEO:
		// 		return "";
		// 	case FILE_TYPE.AUDIO:
		// 		return "";
		// 	case FILE_TYPE.ARCHIVE:
		// 		return "";
		// 	case FILE_TYPE.PDF:
		// 		return "";
		// 	case FILE_TYPE.EPUB:
		// 		return "";
		// 	case FILE_TYPE.DOCUMENT:
		// 		return "";
		// 	case FILE_TYPE.OTHER:
		// 		return "";
		// }

		return "";
	}
}
