import { hfs } from "@humanfs/web";
import {
	parse,
	stringify,
	stringifyAsync,
} from "@worker-tools/structured-json";
import { DEFAULT_FILE_NAME, ROOT_PATH } from "~/shared/constants";
import { FILE_TYPE } from "~/shared/enums";
import type {
	FileHostID,
	FileHostImplementations,
} from "~/types/file-directory-file-host/file-host";
import type {
	AbsoluteFilePath,
	FileName,
	RelativeDirectoryPath,
	RelativeFilePath,
} from "~/types/path";
import { getExtensionFromFileName } from "~/utils/file-name";
import { downloadBlobToDisk } from "~/utils/other";
import { convertPathToString } from "~/utils/path";
import { FileHost } from "./file-host";

/** A representation of a file fetched from a file-host. At first, it only contains the bare metadata but not the actual file. When interacted with, the actual file will be downloaded */

export class FileHostFile {
	/** The name of the file, without the extension */
	private _name: string;
	/** The extension of the file, e.g `webp`, `7z`, etc */
	private _ext: string;
	/** Absolute path from the root of the OPFS */
	readonly path: AbsoluteFilePath;
	readonly dateCreated: Date;
	/** In bytes */
	size: number;
	// UNUSED
	dateEdited = new Date();
	readonly url: URL;
	/** image string, could be a url, or raw base64 data */
	private _thumbnail: string | null = null;
	private _file: { data: Blob; cachedOn: Date } | null = null;
	/** Cache for the file's mimetype  */
	private _mimeType: string | null = null;
	private _fileHostId: FileHostID;

	/** In milliseconds */
	private static readonly _cacheDuration = 300000;

	constructor(args: {
		name: string;
		relativePath: RelativeDirectoryPath;
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

		const ext = getExtensionFromFileName(argName);
		const name = argName.slice(0, argName.lastIndexOf(`.${ext}`));

		this._name = name;
		this._ext = ext;
		this.url = new URL(fileUrl);
		this._fileHostId = fileHostId;
		this._file = fileData ? { cachedOn: new Date(), data: fileData } : null;
		this.dateCreated = dateCreated ?? new Date();
		this.size = size ?? 0;

		// This works, it's just typescript being angry
		this.path = [
			//@ts-expect-error
			...(this.fileHost?.root() ?? []),
			//@ts-expect-error
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
	get relativePath(): RelativeFilePath {
		const fileHostSet = new Set<string>(this.fileHost?.root() ?? []);

		return this.path.filter(
			(pathFragment) => !fileHostSet.has(pathFragment),
		) as RelativeFilePath;
	}

	// If the actual thumbnail for the file cannot be obtained, fall back to default placeholders
	thumbnail(): Exclude<typeof this._thumbnail, undefined> {
		if (this._thumbnail) return this._thumbnail;

		// TODO: Use placeholders
		switch (this.type) {
			case FILE_TYPE.TEXT:
				return "";
			case FILE_TYPE.IMAGE:
				return "";
			case FILE_TYPE.VIDEO:
				return "";
			case FILE_TYPE.AUDIO:
				return "";
			case FILE_TYPE.ARCHIVE:
				return "";
			case FILE_TYPE.PDF:
				return "";
			case FILE_TYPE.EPUB:
				return "";
			case FILE_TYPE.DOCUMENT:
				return "";
			case FILE_TYPE.OTHER:
				return "";
		}

		return "";
	}

	/** Fetches and stores the actual content the instance represents. */
	async getFile(
		/** If true, the file is always fetched from the file host */
		forceDownload = false,
	): Promise<Blob> {
		if (
			this._file &&
			this._file.cachedOn.getTime() + FileHostFile._cacheDuration >
				Date.now() &&
			!forceDownload
		)
			return this._file.data;
		else {
			const fileHost = this.fileHost;

			// Use the file host's implementation if present and successful, otherwise, fall back to a generic fetch
			try {
				if (fileHost) {
					const res = await fileHost.downloadFileContent(this.url);

					if (res.state === "error")
						throw Error(`Failed to fetch file from ${fileHost.name}`);

					const { result } = res;
					this._file = { cachedOn: new Date(), data: result };
					this.size = result.size;
					this.saveToDisk();
					return result;
				} else {
					throw Error("No filehost found. Falling back to default fetch");
				}
			} catch {
				const blob = await (await fetch(this.url)).blob();
				const file = new File([blob], this.name(true));
				this._file = { cachedOn: new Date(), data: file };
				this.size = file.size;
				this.saveToDisk();

				return file;
			}
		}
	}

	/** Basically `.getFile()` and then the result is downloaded */
	async downloadFileToDisk(useLatestFromFileHost = false) {
		downloadBlobToDisk(
			await this.getFile(useLatestFromFileHost),
			this.name(true),
		);
	}

	get type(): FILE_TYPE {
		const { _mimeType } = this;

		if (!_mimeType) return FILE_TYPE.OTHER;

		const includes = (arg: string) => _mimeType.includes(arg);

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

	/** Caches the mime type (since `lookup()` is a server function) */
	private async _cacheMimeType() {
		const { _file, _ext } = this;
		const { mime } = await import("./mime");
		const mimeType =
			_file?.data.type ?? mime.getType(_ext) ?? "application/octet-stream";

		this._mimeType = mimeType;
		// console.log(mimeType)
		return mimeType;
	}

	get fileHost(): FileHostImplementations | null {
		return FileHost.collection.get(this._fileHostId) ?? null;
	}

	// TODO: Add string compression. Maybe we can apply it conditionally depending on the blob size
	static async serialize(instance: FileHostFile) {
		const shouldSerializeAsync = (instance: object): boolean => {
			for (const val of Object.values(instance)) {
				if (val instanceof Blob) {
					return true;
				} else if (typeof val === "object" && val != null) {
					if (shouldSerializeAsync(val as object)) {
						return true;
					}
				}
			}
			return false;
		};

		return shouldSerializeAsync(instance)
			? stringifyAsync(instance)
			: stringify(instance);
	}

	async saveToDisk() {
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
