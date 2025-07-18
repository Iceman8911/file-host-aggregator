export enum FILE_HOSTS {
	MEGA = "Mega Sync",
}

/** Categories for the type of a file.
 *
 * Like all "png", "jpg", "webp", etc files are `FileType.IMAGE`
 */
export enum FILE_TYPE {
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

/** For keeping track of queries */
export enum QUERY_NAME {
	IS_CONNECTED = "isConnected",
}
