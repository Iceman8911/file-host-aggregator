export const FILE_HOSTS = {
	MEGA: "Mega Sync",
} as const;

export type FILE_HOSTS = (typeof FILE_HOSTS)[keyof typeof FILE_HOSTS];

/** Categories for the type of a file.
 *
 * Like all "png", "jpg", "webp", etc files are `FileType.IMAGE`
 */
export const FILE_TYPE = {
	TEXT: "txt",
	IMAGE: "img",
	VIDEO: "vid",
	AUDIO: "aud",
	ARCHIVE: "zip",

	PDF: "pdf",
	EPUB: "epub",

	/** Generic text document stored in a binary format, e.g `.docx`, `.xlsx`,etc */
	DOCUMENT: "doc",
	OTHER: "bin",
} as const;

export type FILE_TYPE = (typeof FILE_TYPE)[keyof typeof FILE_TYPE];

/** For keeping track of queries */
export const QUERY_NAME = {
	IS_CONNECTED: "isConnected",
};

export type QUERY_NAME = (typeof QUERY_NAME)[keyof typeof QUERY_NAME];
