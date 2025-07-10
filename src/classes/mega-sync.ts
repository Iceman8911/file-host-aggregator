import { hfs } from "@humanfs/web";
import type { MutableFile } from "megajs";
import { gFileHosts } from "~/declarations/enums";
import {
	convertPathToString,
	gIsUserConnectedToInternet,
	gThrowIfNoInternet,
} from "~/declarations/functions";
import type {
	ClassPropsOnly,
	ExtractValueTypeFromPromise,
	FileName,
	RelativeDirectoryPath,
	RelativeFilePath,
	ResultType,
} from "~/declarations/types";
import { DEFAULT_FILE_NAME, ROOT_PATH } from "~/declarations/variables";
import { FileHost, FileHostFile } from "./file-host";

const { Storage: MegaSyncStorage, File: MegaFile } = await import("megajs");
const USER_AGENT = "FileHostAggregator/0.1";

type AccountInfo = ExtractValueTypeFromPromise<
	ReturnType<typeof MegaSyncStorage.prototype.getAccountInfo>
>;

export class MegaSyncFileHost extends FileHost {
	type = gFileHosts.MEGA;

	/** Minimum time in milliseconds before the caches are refreshed */
	private static readonly _refreshCacheIn = 30000;
	private _accountInfoCache: { info: AccountInfo; cachedOn: Date } | null =
		null;

	constructor(
		public name: string,
		public email: string,
		public password: string,
		private _storage: typeof MegaSyncStorage.prototype | null,
	) {
		super(name);
	}

	export() {
		const { _accountInfoCache, id, dateCreated, name, email, password, type } =
			this;
		return { _accountInfoCache, id, dateCreated, name, email, password, type };
	}

	/** @throws if a stable internet connection cannot be established */
	private async _initMEGAStorage(
		...args: ConstructorParameters<typeof MegaSyncStorage>
	) {
		gThrowIfNoInternet();

		this._storage = await new MegaSyncStorage(...args).ready;

		await this.downloadFiles();

		return this._storage;
	}

	/** Returns the MEGA storage object. If it is not initialized, it will be initialized */
	private async _getStorage() {
		return (
			this._storage ??
			(await this._initMEGAStorage({
				email: this.email,
				password: this.password,
				userAgent: USER_AGENT,
			}))
		);
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
		const instance = new MegaSyncFileHost(name, email, password, null);

		// Loop through and restore the props
		if (arg.restore) {
			for (const key in arg) {
				//@ts-expect-error
				instance[key] = arg[key];
			}
		}

		try {
			// Not `await`ed since it may cause a little delay
			instance._initMEGAStorage({
				email,
				password,
				userAgent: USER_AGENT,
			});
		} catch (_) {
			console.error(
				"Unable to connect to MEGA Sync. Some features may be unavailable",
			);
		}

		// Save after successful initialization
		await instance.save();

		return instance;
	}

	/** Returns the folder at the specified path on the **server** while auto-creating missing folders if needed */
	private async _getFolder(
		path: RelativeDirectoryPath,
		folderToStartFrom = this._storage?.root,
	): Promise<MutableFile> {
		if (!folderToStartFrom) throw Error("MEGA storage not initialized");
		if (!path.length) return folderToStartFrom;
		const directoryToFindOrCreate = path[0];
		const restOfDirectoryPath: RelativeDirectoryPath = path.slice(1);

		const createdOrFoundDirectory =
			folderToStartFrom.find(directoryToFindOrCreate) ??
			(await folderToStartFrom.mkdir(directoryToFindOrCreate));

		return this._getFolder(restOfDirectoryPath, createdOrFoundDirectory);
	}

	async uploadFile(
		file: Blob,
		path: RelativeDirectoryPath,
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

	async downloadFileContent(url: URL): Promise<ResultType<Blob>> {
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
		const { _storage, email, password } = this;
		if (!_storage) {
			this._initMEGAStorage({
				email,
				password,
				userAgent: USER_AGENT,
			});
			return;
		}

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
					size: ref.size,
				});
			} else {
				type FileAndPath = {
					file: MutableFile;
					relativePath: RelativeDirectoryPath;
				};

				// Recursively loop through it's children until we find the files.
				const searchForNestedFiles = (
					possibleDirectory: MutableFile,
					pathAccumulator: RelativeDirectoryPath,
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
						size: file.size,
					});
				});
			}
		}

		// Ensure that all unneeded files are gone
		await this.trimOutdatedCache();
	}

	async trimOutdatedCache(): Promise<void> {
		const { _storage } = this;
		if (!_storage) return;

		const allFiles = await this.getAllFiles();

		for (const file of allFiles) {
			const fileRelativePath = file.relativePath;
			const possibleFileOnFileHost = _storage.root.navigate(fileRelativePath);

			if (!possibleFileOnFileHost) {
				// The file doesn't exist on the server so ensure it isn't on the client too
				await hfs.delete(convertPathToString(file.path));
			}
		}

		this.clearDirContentCache();
		this.clearDirectoryStatsCache();
	}

	private async _getAccountInfo() {
		const { _accountInfoCache: accountInfo } = this;
		// If the cache is not empty, is still valid (or there is no stable internet connection), return the cached info
		if (
			accountInfo &&
			(Date.now() - accountInfo.cachedOn.getTime() <
				MegaSyncFileHost._refreshCacheIn ||
				!(await gIsUserConnectedToInternet()))
		)
			return accountInfo.info;

		this._accountInfoCache = {
			cachedOn: new Date(),
			info: await (await this._getStorage()).getAccountInfo(),
		};

		this.save();

		return this._accountInfoCache.info;
	}

	async spaceTotal(): Promise<number> {
		return (await this._getAccountInfo()).spaceTotal;
	}

	async spaceUsed(): Promise<number> {
		return (await this._getAccountInfo()).spaceUsed;
	}

	async deleteFile(
		file: RelativeFilePath,
		permanent = false,
	): Promise<boolean> {
		const { _storage } = this;
		if (!_storage) throw Error("MEGA storage not initialized");

		const fileToDelete = _storage.root.navigate(file);
		if (!fileToDelete) return false;

		await fileToDelete.delete(permanent);
		await hfs.delete(
			convertPathToString(this._getAbsolutePathFromRelativePath(file)),
		);
		this.clearDirContentCache();
		this.clearDirectoryStatsCache();

		return true;
	}

	async deleteDirectory(
		directory: RelativeDirectoryPath,
		permanent?: true,
	): Promise<boolean> {
		const { _storage } = this;
		if (!_storage) throw Error("MEGA storage not initialized");

		const directoryToDelete = _storage.root.navigate(directory);
		if (!directoryToDelete) return false;

		await directoryToDelete.delete(permanent);
		await hfs.delete(
			convertPathToString(this._getAbsolutePathFromRelativePath(directory)),
		);
		this.clearDirContentCache();
		this.clearDirectoryStatsCache();

		return true;
	}
}
