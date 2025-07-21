import { hfs } from "@humanfs/web";
import type { MutableFile } from "megajs";
import { Storage as MEGASyncStorage, File as MegaFile } from "megajs";
import {
	DEFAULT_FILE_NAME,
	DEFAULT_FOLDER_NAME,
	ROOT_PATH,
} from "~/shared/constants";
import { FILE_HOSTS } from "~/shared/enums";
import type {
	ClassPropsOnly,
	ExtractValueTypeFromPromise,
	ResultType,
} from "~/types/generics";
import type {
	FileName,
	RelativeDirectoryPath,
	RelativeFileOrDirectoryPath,
	RelativeFilePath,
} from "~/types/path";
import { treatStringAsFileName } from "~/utils/file-name";
import {
	gIsUserConnectedToInternet,
	gThrowIfNoInternet,
} from "~/utils/internet";
import { convertPathToString, isDirectoryPath, isFilePath } from "~/utils/path";
import { FileHost } from "./file-host";
import { FileHostFile } from "./file-host-file";

const USER_AGENT = "FileHostAggregator/0.1";
const MEGA_CONNECTION_ERROR_MESSAGE =
	"Unable to connect to MEGA Sync. Some features may be unavailable";

type AccountInfo = ExtractValueTypeFromPromise<
	ReturnType<typeof MEGASyncStorage.prototype.getAccountInfo>
>;

export class MEGASyncFileHost extends FileHost {
	type = FILE_HOSTS.MEGA;

	/** Minimum time in milliseconds before the caches are refreshed */
	private static readonly _refreshCacheIn = 30000;
	private _accountInfoCache: { info: AccountInfo; cachedOn: Date } | null =
		null;

	constructor(
		public override name: string,
		public email: string,
		public password: string,
		private _storage: typeof MEGASyncStorage.prototype | null,
	) {
		super(name);
	}

	export() {
		const { _accountInfoCache, id, dateCreated, name, email, password, type } =
			this;
		return { _accountInfoCache, id, dateCreated, name, email, password, type };
	}

	private async _initMEGAStorage(
		...args: ConstructorParameters<typeof MEGASyncStorage>
	) {
		gThrowIfNoInternet();

		if (!this._storage) {
			this._storage = await new MEGASyncStorage(...args).ready;
			await this.downloadFiles();
		}

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
			| (ClassPropsOnly<MEGASyncFileHost> & { restore: true }),
	) {
		const { email, name, password } = arg;
		const instance = new MEGASyncFileHost(name, email, password, null);

		if (arg.restore) {
			Object.assign(instance, arg);
		}

		try {
			// Fire and forget, but handle errors
			instance
				._initMEGAStorage({
					email,
					password,
					userAgent: USER_AGENT,
				})
				.catch((err) => {
					console.error(MEGA_CONNECTION_ERROR_MESSAGE, err);
				});
		} catch (err) {
			console.error(MEGA_CONNECTION_ERROR_MESSAGE, err);
		}

		await instance.save();
		return instance;
	}

	/** Returns the folder at the specified path on the **server** while auto-creating missing folders if needed */
	private async _getFolder(
		path: RelativeDirectoryPath,
		folderToStartFrom?: MutableFile,
	): Promise<MutableFile> {
		if (!folderToStartFrom) folderToStartFrom = (await this._getStorage()).root;
		if (!path.length) return folderToStartFrom;
		const [directoryToFindOrCreate, ...restOfDirectoryPath] = path;

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
			const _storage = await this._getStorage();

			return Promise.all([
				this._getFolder(path, _storage.root),
				file.arrayBuffer(),
			]).then(async ([folder, buffer]) => {
				const bufferSize = buffer.maxByteLength;

				const uploadedFile = (await folder.upload(
					{ name, size: bufferSize },
					//@ts-expect-error This is actually alright, the type is justed botched
					new Uint8Array(buffer),
				).complete) as MutableFile;

				const fileName = treatStringAsFileName(
					uploadedFile.name ?? DEFAULT_FILE_NAME,
				);

				const absoluteFilePath = this.getAbsolutePathFromRelativePath([
					...path,
					fileName,
				]);

				const fileUrl = new URL(await uploadedFile.link({ noKey: false }));

				// Create a new file host instance but no need to await it since it's not relevant to the returned value.
				await FileHostFile.init(
					[
						{
							dateCreated: new Date(uploadedFile.createdAt),
							url: fileUrl,
							name: fileName,
							absolutePath: absoluteFilePath,
							size: uploadedFile.size ?? 0,
						},
					],
					file,
				);

				// // Clear the cache for the directory
				// this.clearAllCaches(MEGASyncFileHost.getParentDirectoryFromPath(absoluteFilePath))

				return {
					state: "success",
					result: fileUrl,
				};
			});
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
				await MEGASyncFileHost._downloadFileContent(fileFromUrl);
			if (!possibleBlob) throw Error("File unavailable");
			return { result: possibleBlob, state: "success" };
		} catch (e) {
			return { error: e, state: "error" };
		}
	}

	/** To know if a given mutable file is actually the root drive / trash / inbox */
	private async _isMutableFileSpecial(
		mutableFile: MutableFile,
	): Promise<
		| { root: true; trash: false; inbox: false }
		| { root: false; trash: true; inbox: false }
		| { root: false; trash: false; inbox: true }
		| { root: false; trash: false; inbox: false }
	> {
		const {
			inbox: { nodeId: inboxId },
			root: { nodeId: rootId },
			trash: { nodeId: trashId },
		} = await this._getStorage();

		const { nodeId: mutableFileId } = mutableFile;

		if (!mutableFileId) return { inbox: false, root: false, trash: false };
		else {
			if (mutableFileId === rootId)
				return { inbox: false, root: true, trash: false };

			if (mutableFileId === inboxId)
				return { inbox: true, root: false, trash: false };

			if (mutableFileId === trashId)
				return { inbox: false, root: false, trash: true };
		}

		return { inbox: false, root: false, trash: false };
	}

	/** Stops at the root path / "Cloud Drive" */
	private async _getRelativePathFromMutableFile(
		mutableFile: MutableFile,
	): Promise<RelativeFileOrDirectoryPath> {
		const self = this;

		async function getRelativePath(
			mutableFile: MutableFile,
			accumulator: RelativeFileOrDirectoryPath = mutableFile instanceof
			MEGASyncStorage
				? ROOT_PATH
				: [
						mutableFile.name ??
							(mutableFile.directory ? DEFAULT_FOLDER_NAME : DEFAULT_FILE_NAME),
					],
		): Promise<RelativeFileOrDirectoryPath> {
			const { parent } = mutableFile;

			if (parent && !(await self._isMutableFileSpecial(parent)).root) {
				return getRelativePath(parent, [
					parent.name ?? DEFAULT_FOLDER_NAME,
					...accumulator,
				]);
			}

			return accumulator;
		}

		return getRelativePath(mutableFile);
	}

	/** For iterating through every file / directory structure in the MEGA drive.
	 *
	 * @param mutableFiles If not given, the transversal starts from the root
	 */
	private async *_transverseFileRefs(
		mutableFiles?: MutableFile[],
	): AsyncGenerator<
		| {
				data: MutableFile;
				type: "dir";
				path: RelativeDirectoryPath;
		  }
		| {
				data: MutableFile;
				type: "file";
				path: RelativeFilePath;
		  }
	> {
		const directChildfileRefs =
			mutableFiles ?? (await this._getStorage()).filter(() => true);

		for (const fileRef of directChildfileRefs) {
			const relativePath = await this._getRelativePathFromMutableFile(fileRef);

			if (!fileRef.directory && isFilePath(relativePath)) {
				yield { data: fileRef, path: relativePath, type: "file" };
			} else if (isDirectoryPath(relativePath)) {
				yield { data: fileRef, path: relativePath, type: "dir" };

				if (fileRef.children) yield* this._transverseFileRefs(fileRef.children);
			}
		}
	}

	async downloadFiles(getMetadataOnly = true): Promise<void> {
		const downloadFileData = async (
			file: MutableFile,
			relativePath: RelativeFilePath,
		) => {
			const fileName = treatStringAsFileName(file.name ?? DEFAULT_FILE_NAME);

			const fileInstance = await FileHostFile.init([
				{
					dateCreated: new Date(file.createdAt),
					url: new URL(await file.link({ noKey: false })),
					name: fileName,
					absolutePath: this.getAbsolutePathFromRelativePath(relativePath),
					size: file.size ?? 0,
				},
			]);

			if (!getMetadataOnly) {
				await fileInstance.getBlob(true);
			}
		};

		const downloadPromises: Array<Promise<unknown>> = [];

		for await (const { data, path, type } of this._transverseFileRefs()) {
			if (type === "file") downloadPromises.push(downloadFileData(data, path));
		}

		await Promise.allSettled(
			[downloadPromises, this.trimOutdatedCache()].flat(),
		);
	}

	async trimOutdatedCache(): Promise<void> {
		const _storage = await this._getStorage();

		const allFiles = this.getAllFiles();

		for await (const file of allFiles) {
			const possibleFileOnFileHost = _storage.root.navigate([
				...file.metadata.relativePath,
			]);

			if (!possibleFileOnFileHost) {
				// The file doesn't exist on the server so ensure it isn't on the client too
				await file.delete();
			}
		}

		// this.clearDirContentCache();
		// this.clearDirectoryStatsCache();
	}

	private async _getAccountInfo() {
		if (
			this._accountInfoCache &&
			(Date.now() - this._accountInfoCache.cachedOn.getTime() <
				MEGASyncFileHost._refreshCacheIn ||
				!(await gIsUserConnectedToInternet()))
		) {
			return this._accountInfoCache.info;
		}

		const info = await (await this._getStorage()).getAccountInfo();

		this._accountInfoCache = { cachedOn: new Date(), info };

		this.save();

		return info;
	}

	async spaceTotal(): Promise<number> {
		return (await this._getAccountInfo()).spaceTotal;
	}

	async spaceUsed(): Promise<number> {
		return (await this._getAccountInfo()).spaceUsed;
	}

	/** Since files and directories aren't treated too differently in the library I'm using */
	private async _deleteFileOrDirectory(
		fileOrDir: RelativeFileOrDirectoryPath,
		permanent = false,
	) {
		const _storage = await this._getStorage();
		const fileToDelete = _storage.root.navigate([...fileOrDir]);
		if (!fileToDelete) return false;

		await Promise.allSettled([
			fileToDelete.delete(permanent),
			this._deleteLocalFileOrDirectory(
				this.getAbsolutePathFromRelativePath(fileOrDir),
			),
		]);

		return true;
	}

	async deleteFile(
		file: RelativeFilePath,
		permanent = false,
	): Promise<boolean> {
		return this._deleteFileOrDirectory(file, permanent);
	}

	async deleteDirectory(
		directory: RelativeDirectoryPath,
		permanent = false,
	): Promise<boolean> {
		return this._deleteFileOrDirectory(directory, permanent);
	}
}
