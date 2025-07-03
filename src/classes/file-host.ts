import { hfs } from "@humanfs/web";
import { ReactiveMap } from "@solid-primitives/map";
import { parse, stringifyAsync } from "@worker-tools/structured-json";
import { signalify } from "classy-solid";
import { gFileHosts } from "~/declarations/enums";
import { Directory } from "~/declarations/file-system";
import { generateUUID } from "~/declarations/functions";
import type {
	Brand,
	ClassPropsOnly,
	FilePath,
	FilePathWithExtension,
	ResultType,
	UUID,
} from "~/declarations/types";
import gMimeTypeClientFunctions from "~/server/mime-types/mime-types-client";
import type { MegaSyncFileHost } from "./mega-sync";

export type FileHostID = Brand<UUID, "FileHostID">;
export type FileHostImplementations = MegaSyncFileHost;
export type FileHostClassProps = ReturnType<FileHostImplementations["export"]>;

const { extension, lookup } = gMimeTypeClientFunctions;

const DEFAULT_FILE_EXTENSION = "bin";

/** Every file host (e.g Mega, MediaFire, etc) must implement this */
export abstract class FileHost {
	readonly id: FileHostID = generateUUID<FileHostID>();
	dateCreated = new Date();
	abstract readonly type: gFileHosts;

	/** In memory collection of all created file hosts */
	static collection = new ReactiveMap<FileHostID, FileHostImplementations>();

	constructor(public name: string) {
		FileHost.collection.set(this.id, this);
		// signalify(this);
	}

	/** **MUST BE IMPLEMENTED IN DERIVED CLASSES BEFOR USE** */
	static init(...args: unknown[]): Promise<FileHostImplementations> {
		throw new Error("Method not implemented! Use derived class");
	}

	/**Caches all files from the file host in the file system */
	abstract downloadFiles(
		/** If `true`, only the bare metadata (like path data, names, sizes) are retrieved, but the file's actual content is not */
		getMetadata?: boolean,
	): Promise<void>;

	/** Takes a regular file and the path to upload it to.
	 *
	 * Returns the url to the uploaded file if successful
	 */
	abstract uploadFile(
		file: Blob,
		path: FilePath,
		/** In case the file's name should be overwritten */
		name: string,
	): Promise<ResultType<URL>>;

	/** Attempts to delete a file from the file host */
	abstract deleteFile(file: FilePathWithExtension): ResultType<never>;

	async hasFile(path: FilePathWithExtension): Promise<boolean> {
		return hfs.isFile(path);
	}

	/**  */
	async getFile(
		path: FilePathWithExtension,
	): Promise<FileHostFile<this> | null> {
		if (!(await hfs.isFile(path))) return null;

		const possibleFileData = await hfs.text(path);

		if (!possibleFileData) return null;

		return FileHostFile.deserialize(possibleFileData, this);
	}

	/** @returns `null` if the directory doesn't exist */
	async getDirContents(path: FilePathWithExtension): Promise<
		| (Array<{ type: "file"; file: FileHostFile<this> }> & {
				length: 1;
		  })
		| null
	>;
	async getDirContents(
		path: FilePath | FilePathWithExtension,
	): Promise<Array<
		{ type: "dir"; name: string } | { type: "file"; file: FileHostFile<this> }
	> | null>;
	async getDirContents(
		path: FilePath | FilePathWithExtension,
	): Promise<Array<
		{ type: "dir"; name: string } | { type: "file"; file: FileHostFile<this> }
	> | null> {
		if (path !== "/" && (await hfs.isFile(path))) {
			const possibleFile = await this.getFile(path as FilePathWithExtension);

			if (possibleFile) return [{ type: "file", file: possibleFile }];
		}

		const res: Array<
			{ type: "dir"; name: string } | { type: "file"; file: FileHostFile<this> }
		> = [];

		if (await hfs.isDirectory(path)) {
			for await (const entry of hfs.list(path)) {
				const { isDirectory, isFile, name: _name } = entry;
				const name = _name as `${string}.${string}`;

				if (isFile) {
					const possibleFile = await this.getFile(`${path}/${name}`);
					if (possibleFile) res.push({ file: possibleFile, type: "file" });
				} else if (isDirectory) {
					res.push({ name, type: "dir" });
				}
			}
		}

		return res.length ? res : null;
	}

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
	root() {
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
	for await (const entry of hfs.list(fileHostRoot())) {
		const { isFile, name } = entry;

		if (name.endsWith(".bin") && isFile) {
			const fileHostId = name as FileHostID;
			const props: FileHostClassProps = await hfs.json(
				fileHostRoot(fileHostId),
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

/** A representation of a file fetched from a file-host. At first, it only contains the bare metadata but not the actual file. When interacted with, the actual file will be downloaded */
export class FileHostFile<
	TFileHostParent extends FileHostImplementations = FileHostImplementations,
> {
	/** The name of the file, without the extension */
	private _name: string;
	/** The extension of the file, e.g `webp`, `7z`, etc */
	private _ext: string;
	readonly path: FilePath;
	readonly dateCreated = new Date();
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
		path: FilePath;
		fileUrl: URL | string;
		fileHostId: FileHostID;
	}) {
		const { fileHostId, fileUrl, name: argName, path } = args;

		const [name, ext] = argName.split(/\.(?!.*\.)/);
		this._name = name;
		this._ext = ext;
		this.path = path;
		this._url = new URL(fileUrl);
		this._fileHostId = fileHostId;

		// TODO - Determine file type without necessarily downloading the entire file

		const parentFileHost = FileHost.collection.get(fileHostId);
		const { _file } = this;
		if (parentFileHost && _file) {
			// Store the file in the filesystem.
			_file.arrayBuffer().then((buffer) => {
				hfs.write(parentFileHost.root(), buffer);
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

	static async serialize(instance: FileHostFile) {
		return stringifyAsync(instance);
	}

	static async deserialize<TFileHost extends FileHostImplementations>(
		data: string,
		fileHostParent: TFileHost,
	) {
		const deserializedData: FileHostFile<TFileHost> = await parse(data);
		console.log("Deserialized Data is:", deserializedData);
		const newClass = new FileHostFile<TFileHost>({
			fileHostId: fileHostParent.id,
			fileUrl: window.location.href,
			name: "",
			path: "/",
		});

		for (const key in deserializedData) {
			//@ts-expect-error
			newClass[key] = data[key];
		}

		return newClass;
	}
}
