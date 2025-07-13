import { FileHost } from "~/classes/file-host";
import { FileHostFile } from "~/classes/file-host-file";
import type { FileOrDirectoryOrFileHost } from "~/types/file-directory-file-host/file-directory-file-host";
import type {
	AbsoluteDirectoryPath,
	AbsoluteFilePath,
	RelativeDirectoryPath,
	RelativeFilePath,
} from "~/types/path";
import { convertPathToString } from "../path";

type Size = {
	/** In bytes */
	raw: number;
	parsed: `${string} bytes` | `${string} KB` | `${string} MB` | `${string} GB`;
};

type CommonData =
	| {
			type: "file";
			name: string;
			dateCreated: Date;
			size: Size;
			url: URL;
			path: {
				absolute: AbsoluteFilePath;
				relative: RelativeFilePath;
				/** Human-readable path that is the combination of the parent file host name and relative path */
				legiblePath: string;
			};
	  }
	| {
			type: "folder";
			name: string;
			dateCreated: Date;
			size: Size;
			path: {
				absolute: AbsoluteDirectoryPath;
				relative: RelativeDirectoryPath;
				/** Human-readable path that is the combination of the parent file host name and relative path */
				legiblePath: string;
			};
			contentCount: { files: number; folders: number };
	  }
	| {
			type: "file host";
			name: string;
			dateCreated: Date;
			size: Promise<Size>;
			path: {
				absolute: ReturnType<FileHost["root"]>;
				/** Human-readable path that is simply the name of the file host + "/" */
				legiblePath: `${string}/`;
			};
			contentCount: { files: number; folders: number };
	  };

/** Helper for extracting common data */
export function getCommonPropsFromFileOrFileHostOrDirectory(
	obj: FileOrDirectoryOrFileHost,
): CommonData {
	/** To convert a number in bytes to kb, mb, gb */
	const convertBytes = (bytes: number) => {
		if (bytes < 1024) return `${bytes} bytes` as const;
		else if (bytes < 1024 * 1024)
			return `${(bytes / 1024).toFixed(2)} KB` as const;
		else if (bytes < 1024 * 1024 * 1024)
			return `${(bytes / (1024 * 1024)).toFixed(2)} MB` as const;
		else return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB` as const;
	};

	if (obj instanceof FileHost) {
		const name = obj.name;

		return {
			// TODO: make a thod to get these stuff
			contentCount: { files: 0, folders: 0 },
			dateCreated: obj.dateCreated,
			name: name,
			path: { absolute: obj.root(), legiblePath: `${name}/` },
			size: obj.spaceUsed().then((size) => {
				return { parsed: convertBytes(size), raw: size };
			}),
			type: "file host",
		};
	} else if (obj instanceof FileHostFile) {
		return {
			dateCreated: obj.dateCreated,
			name: obj.name(true),
			path: {
				absolute: obj.path,
				legiblePath: `${obj.fileHost?.name ?? ""}/${convertPathToString(obj.relativePath)}`,
				relative: obj.relativePath,
			},
			size: { parsed: convertBytes(obj.size), raw: obj.size },
			type: "file",
			url: obj.url,
		};
	} else {
		const relativePath = FileHost.getRelativePathFromAbsolutePath(obj.path);
		return {
			contentCount: { files: obj.fileCount, folders: obj.folderCount },
			dateCreated: obj.dateEdited,
			name: obj.name,
			path: {
				absolute: obj.path,
				legiblePath: `${FileHost.collection.get(obj.path[1])?.name ?? ""}/${convertPathToString(relativePath)}`,
				relative: relativePath,
			},
			size: { parsed: convertBytes(obj.size), raw: obj.size },
			type: "folder",
		};
	}
}
