import type { gEnumFileHost } from "~/declarations/enums";
import type { FilePath } from "~/declarations/types";
import gMimeTypeClientFunctions from "~/server/mime-types/mime-types-client";

const { extension, lookup } = gMimeTypeClientFunctions;

/** Every file host (e.g Mega, MediaFire, etc) must implement this */
export abstract class FileHost<TFileHost extends gEnumFileHost> {
	dateCreated = new Date();
	abstract readonly type: TFileHost;

	constructor(
		public name: string,
		protected _apiKey: string,
	) {}

	abstract getFiles(): FileHostFile[];
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
class FileHostFile {
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
	private _file: File | null = null;
	/** Cache for the file's mimetype  */
	private _mimeType: string | null = null;

	constructor(args: FileHostFilePublicProps & { fileUrl: URL | string }) {
		const [name, ext] = args.name.split(/\.(?!.*\.)/);
		this._name = name;
		this._ext = ext;
		this.path = args.path;
		this.dateCreated = args.dateCreated;
		this.dateEdited = args.dateEdited;
		this._url = new URL(args.fileUrl);

		// TODO - Determine file type without necessarily downloading the entire file
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

	async file(): Promise<File> {
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
}
