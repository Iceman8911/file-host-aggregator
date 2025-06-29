import { hfs } from "@humanfs/web";
import type { gFileHosts } from "~/declarations/enums";
import { Directory } from "~/declarations/file-system";
import { generateUUID } from "~/declarations/functions";
import type {
	Brand,
	ClassPropsOnly,
	FilePath,
	ResultType,
	UUID,
} from "~/declarations/types";
import gMimeTypeClientFunctions from "~/server/mime-types/mime-types-client";
import type { MegaSyncFileHost } from "./mega-sync";

type FileHostID = Brand<UUID, "FileHostID">;
export type FileHostImplementations = MegaSyncFileHost;
export type FileHostClassProps = ReturnType<FileHostImplementations["export"]>;

const { extension, lookup } = gMimeTypeClientFunctions;

const DEFAULT_FILE_EXTENSION = "bin";
const fileHostMemoryCollection = new Map<FileHostID, FileHostImplementations>();

/** Every file host (e.g Mega, MediaFire, etc) must implement this */
export abstract class FileHost {
	readonly id: FileHostID = generateUUID<FileHostID>();
	dateCreated = new Date();
	abstract readonly type: gFileHosts;

	constructor(
		public name: string,
		public apiKey: string,
	) {
		fileHostMemoryCollection.set(this.id, this);
	}

	/** Returns a collection of all the files in the file host, while caching it */
	abstract getFiles(
		/** If `true`, only the bare metadata (like path data, names, sizes) are retrieved, but the file's actual content is not */
		getMetadata?: boolean,
	): Map<FilePath, FileHostFile<this>>;

	/** Takes a regular file and the path to upload it to.
	 *
	 * Returns the url to the uploaded file if successful
	 */
	abstract uploadFile(
		file: File,
		path: FilePath,
		/** In case the file's name should be overwritten */
		name?: string,
	): ResultType<URL>;

	/** Attempts to delete a file from the file host */
	abstract deleteFile(file: FileHostFile<this>): ResultType<never>;

	clearCache(): void {
		// this._files = new Map();
	}

	/** Returns the directory that contains all files for the filehost, using it's id.
	 *
	 * If no id is given, the root where all filehosts are stored is returned.
	 *
	 * e.g `/file_host/123po12`
	 */
	static root(): Directory.FILE_HOST;
	static root(id: FileHostID): `${Directory.FILE_HOST}/${FileHostID}`;
	static root(
		id: FileHostID,
		getSaveLocation: true,
	): `${Directory.FILE_HOST}/${FileHostID}.${typeof DEFAULT_FILE_EXTENSION}`;
	static root(id?: FileHostID, getSaveLocation = false) {
		const { FILE_HOST } = Directory;
		if (!id) return FILE_HOST;

		return getSaveLocation
			? (`${FILE_HOST}/${id}.${DEFAULT_FILE_EXTENSION}` as const)
			: (`${FILE_HOST}/${id}` as const);
	}

	/** Returns the directory that contains all files for the filehost.
	 *
	 * e.g `/file_host/123po12`
	 */
	get root() {
		return FileHost.root(this.id);
	}

	/** Saves the instance to disk
	 *
	 * e.g `/file_host/123po12.bin`
	 */
	save() {
		return hfs.write(
			FileHost.root(this.id, true),
			JSON.stringify(this.export()),
		);
	}

	/** Returns a serializable version of the class that the class can be instantiated with `.import()` */
	export(): ClassPropsOnly<typeof this> {
		return { ...this };
	}

	/** Restores data exportd with `.export()` */
	import(data: ClassPropsOnly<typeof this>) {
		for (const key in data) {
			this[key] = data[key];
		}
	}
}

/** Initializes all stored file hosts and returns an array of them as result */
export async function initFileHosts(): Promise<ReadonlyArray<FileHost>> {
	const fileHosts: Array<FileHost> = [];
	const { root: fileHostRoot } = FileHost;

	// Load all file hosts from the disk
	for await (const entry of hfs.list(fileHostRoot())) {
		const { isFile, name } = entry;

		if (isFile) {
			const fileHostId = name as FileHostID;
			const { type }: FileHostClassProps = await hfs.json(
				fileHostRoot(fileHostId),
			);

			// TODO: Depending on the `.type`, instantiate the appropriate class
			switch (type) {
			}
		}
	}

	fileHosts.forEach((host) => {
		fileHostMemoryCollection.set(host.id, host);
	});

	return fileHosts;
}

enum FileType {
	TEXT,
	IMAGE,
	VIDEO,
	AUDIO,
	ARCHIVE,

	PDF,
	EPUB,
	/** Generic text document stored in a binary format, e.g `.docx`, `.xlsx`,etc */
	DOCUMENT,
	OTHER,
}

type FileHostFilePublicProps = {
	name: string;
	path: FilePath;
	dateCreated: Date;
	dateEdited: Date;
};

/** A representation of a file fetched from a file-host. At first, it only contains the bare metadata but not the actual file. When interacted with, the actual file will be downloaded */
class FileHostFile<TFileHostParent extends FileHostImplementations> {
	/** The name of the file, without the extension */
	private _name: string;
	/** The extension of the file, e.g `webp`, `7z`, etc */
	private _ext: string;
	readonly path: FilePath;
	readonly dateCreated: Date;
	dateEdited: Date;
	private readonly _url: URL;
	/** image string, could be a url, or raw base64 data */
	private _thumbnail: string | null = null;
	private _file: Blob | null = null;
	/** Cache for the file's mimetype  */
	private _mimeType: string | null = null;
	private _fileHostId: FileHostID;

	constructor(
		args: FileHostFilePublicProps & {
			fileUrl: URL | string;
			fileHostId: FileHostID;
		},
	) {
		const {
			dateCreated,
			dateEdited,
			fileHostId,
			fileUrl,
			name: argName,
			path,
		} = args;

		const [name, ext] = argName.split(/\.(?!.*\.)/);
		this._name = name;
		this._ext = ext;
		this.path = path;
		this.dateCreated = dateCreated;
		this.dateEdited = dateEdited;
		this._url = new URL(fileUrl);
		this._fileHostId = fileHostId;

		// TODO - Determine file type without necessarily downloading the entire file

		const parentFileHost = fileHostMemoryCollection.get(fileHostId);
		const { _file } = this;
		if (parentFileHost && _file) {
			// Store the file in the filesystem.
			_file.arrayBuffer().then((buffer) => {
				hfs.write(parentFileHost.root, buffer);
			});
		}
	}

	name(includeExtension = false): string {
		return includeExtension ? `${this._name}.${this._ext}` : this._name;
	}

	// If the actual thumbnail for the file cannot be obtained, fall back to default placeholders
	thumbnail(): Exclude<typeof this._thumbnail, undefined> {
		if (this._thumbnail) return this._thumbnail;

		// TODO: Use placeholders
		switch (this._type) {
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

	async file(): Promise<Blob> {
		if (this._file) return this._file;
		else {
			const blob = await (await fetch(this._url)).blob();
			const file = new File([blob], `file.${extension(blob.type) || "bin"}`);
			this._file = file;

			return file;
		}
	}

	private get _type(): FileType {
		const { _mimeType } = this;

		const includes = (arg: string) =>
			(_mimeType ?? this._cacheMimeType()).includes(arg);

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
	private _cacheMimeType(): string {
		const { _file, _ext } = this;
		const mimeType =
			_file?.type ?? (lookup(_ext) || "application/octet-stream");

		this._mimeType = mimeType;

		return mimeType;
	}

	get fileHost(): TFileHostParent {
		// TODO: Logic to get the file host from an in memory map

		return {} as unknown as TFileHostParent;
	}
}
