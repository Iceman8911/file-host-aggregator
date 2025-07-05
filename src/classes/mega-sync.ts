import type { MutableFile } from "megajs";
import { gFileHosts } from "~/declarations/enums";
import {
	gIsUserConnectedToInternet,
	gThrowIfNoInternet,
} from "~/declarations/functions";
import type {
	ClassPropsOnly,
	DirectoryPath,
	FileName,
	FilePath,
	ResultType,
} from "~/declarations/types";
import { DEFAULT_FILE_NAME, ROOT_PATH } from "~/declarations/variables";
import { FileHost, FileHostFile } from "./file-host";

const { Storage: MegaSyncStorage, File: MegaFile } = await import("megajs");

export class MegaSyncFileHost extends FileHost {
	type = gFileHosts.MEGA;

	constructor(
		public name: string,
		public email: string,
		public password: string,
		private _storage: typeof MegaSyncStorage.prototype | null,
	) {
		super(name);
	}

	export() {
		const { id, dateCreated, name, email, password, type } = this;
		return { id, dateCreated, name, email, password, type };
	}

	/** Use this to initialize the file host. Can also be used to restore serialized data */
	static override async init(
		arg:
			| { name: string; email: string; password: string; restore: false }
			| (ClassPropsOnly<MegaSyncFileHost> & {
					/** If true, typescript will know that the object props should overwrite the instance's */
					restore: true;
			  }),
	) {
		const { email, name, password } = arg;
		let instance: MegaSyncFileHost;

		try {
			gThrowIfNoInternet();

			const storage = await new MegaSyncStorage({
				email,
				password,
				userAgent: "FileHostAggregator/0.1",
			}).ready;

			instance = new MegaSyncFileHost(name, email, password, storage);
		} catch (_) {
			console.error(
				"Unable to connect to MEGA Sync. Some features may be unavailable",
			);
			instance = new MegaSyncFileHost(name, email, password, null);
		}

		// Loop through and restore the props
		if (arg.restore) {
			for (const key in arg) {
				//@ts-expect-error
				instance[key] = arg[key];
			}
		}
		// Save after successful initialization
		await instance.save();

		await instance.downloadFiles();

		return instance;
	}

	/** Returns the folder at the specified path on the **server** while auto-creating missing folders if needed */
	private async _getFolder(
		path: DirectoryPath,
		folderToStartFrom = this._storage?.root,
	): Promise<MutableFile> {
		if (!folderToStartFrom) throw Error("MEGA storage not initialized");
		if (!path.length) return folderToStartFrom;

		const directoryToFindOrCreate = path[0];
		const restOfDirectoryPath: DirectoryPath = path.slice(1);

		const createdOrFoundDirectory =
			folderToStartFrom.find(directoryToFindOrCreate) ??
			(await folderToStartFrom.mkdir(directoryToFindOrCreate));

		return this._getFolder(restOfDirectoryPath, createdOrFoundDirectory);
	}

	async uploadFile(
		file: Blob,
		path: DirectoryPath,
		name: FileName,
	): Promise<ResultType<URL>> {
		try {
			const { _storage } = this;
			if (!_storage) throw Error("MEGA storage not initialized");

			const folder = await this._getFolder(path);
			const uploadedFile = (await folder.upload(
				{ name: name, size: file.size },
				await file.text(),
			).complete) as MutableFile;
			return {
				state: "success",
				result: new URL(await uploadedFile.link({ noKey: false })),
			};
		} catch (e) {
			return { state: "error", error: e };
		}
	}

	/** TODO: Depending on the file size, use a stream */
	private static async _downloadFileContent(
		file: typeof MegaFile.prototype,
		onlyMetaData = false,
	) {
		if (onlyMetaData) return undefined;

		return new Blob([await file.downloadBuffer({})]);
	}

	async downloadFile(url: URL): Promise<ResultType<Blob>> {
		try {
			const fileFromUrl = MegaFile.fromURL(url.toString());
			const possibleBlob =
				await MegaSyncFileHost._downloadFileContent(fileFromUrl);

			if (!possibleBlob) throw Error("File unavailable");

			return { result: possibleBlob, state: "success" };
		} catch (e) {
			return { error: e, state: "error" };
		}
	}

	async downloadFiles(getMetadataOnly = true): Promise<void> {
		const { _storage } = this;
		if (!_storage) return;

		// Get references to all the files
		const fileRefs = _storage.filter((_) => true);

		for (const ref of fileRefs) {
			// console.log(ref);

			// It's a file at the root level
			if (!ref.directory) {
				await FileHostFile.init({
					dateCreated: new Date(ref.createdAt),
					fileData: await MegaSyncFileHost._downloadFileContent(
						ref,
						getMetadataOnly,
					),
					fileHostId: this.id,
					fileUrl: await ref.link({ noKey: false }),
					name: ref.name ?? DEFAULT_FILE_NAME,
					relativePath: ROOT_PATH,
				});
			} else {
				type FileAndPath = { file: MutableFile; relativePath: DirectoryPath };

				// Recursively loop through it's children until we find the files.
				const searchForNestedFiles = (
					possibleDirectory: MutableFile,
					pathAccumulator: DirectoryPath,
					foundFiles: Array<FileAndPath> = [],
				): ReadonlyArray<FileAndPath> => {
					if (!possibleDirectory.directory) {
						foundFiles.push({
							file: possibleDirectory,
							relativePath: pathAccumulator,
						});
						return foundFiles;
					}

					if (!possibleDirectory.children) return foundFiles;

					return possibleDirectory.children.flatMap((nestedFileOrDirectory) => {
						return searchForNestedFiles(
							nestedFileOrDirectory,
							nestedFileOrDirectory.directory
								? [
										...pathAccumulator,
										nestedFileOrDirectory.name ?? DEFAULT_FILE_NAME,
									]
								: [...pathAccumulator],
							foundFiles,
						);
					});
				};

				searchForNestedFiles(ref, [
					...ROOT_PATH,
					ref.name ?? DEFAULT_FILE_NAME,
				]).forEach(async ({ file, relativePath }) => {
					await FileHostFile.init({
						dateCreated: new Date(file.createdAt),
						fileData: await MegaSyncFileHost._downloadFileContent(
							file,
							getMetadataOnly,
						),
						fileHostId: this.id,
						fileUrl: await file.link({ noKey: false }),
						name: file.name ?? DEFAULT_FILE_NAME,
						relativePath,
					});
				});
			}
		}
	}
}
