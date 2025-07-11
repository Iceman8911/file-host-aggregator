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

const { Storage: MEGASyncStorage, File: MegaFile } = await import("megajs");
const USER_AGENT = "FileHostAggregator/0.1";
const MEGA_CONNECTION_ERROR_MESSAGE =
	"Unable to connect to MEGA Sync. Some features may be unavailable";

type AccountInfo = ExtractValueTypeFromPromise<
	ReturnType<typeof MEGASyncStorage.prototype.getAccountInfo>
>;

export class MEGASyncFileHost extends FileHost {
	type = gFileHosts.MEGA;

	/** Minimum time in milliseconds before the caches are refreshed */
	private static readonly _refreshCacheIn = 30000;
	private _accountInfoCache: { info: AccountInfo; cachedOn: Date } | null =
		null;

	constructor(
		public name: string,
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
		folderToStartFrom = this._storage?.root,
	): Promise<MutableFile> {
		if (!folderToStartFrom) throw Error("MEGA storage not initialized");
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
			const folder = await this._getFolder(path, _storage.root);
			const uploadedFile = (await folder.upload(
				{ name, size: file.size },
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
				await MEGASyncFileHost._downloadFileContent(fileFromUrl);
			if (!possibleBlob) throw Error("File unavailable");
			return { result: possibleBlob, state: "success" };
		} catch (e) {
			return { error: e, state: "error" };
		}
	}

	async downloadFiles(getMetadataOnly = true): Promise<void> {
		const _storage = await this._getStorage();
		const fileRefs = _storage.filter(() => true);

		const processFile = async (
			file: MutableFile,
			relativePath: RelativeDirectoryPath,
		) => {
			await FileHostFile.init({
				dateCreated: new Date(file.createdAt),
				fileData: await MEGASyncFileHost._downloadFileContent(
					file,
					getMetadataOnly,
				),
				fileHostId: this.id,
				fileUrl: await file.link({ noKey: false }),
				name: file.name ?? DEFAULT_FILE_NAME,
				relativePath,
				size: file.size,
			});
		};

		const traverse = async (node: MutableFile, path: RelativeDirectoryPath) => {
			if (!node.directory) {
				await processFile(node, path);
			} else if (node.children) {
				for (const child of node.children) {
					await traverse(
						child,
						child.directory
							? [...path, child.name ?? DEFAULT_FILE_NAME]
							: [...path],
					);
				}
			}
		};

		for (const ref of fileRefs) {
			await traverse(
				ref,
				ref.directory
					? [...ROOT_PATH, ref.name ?? DEFAULT_FILE_NAME]
					: ROOT_PATH,
			);
		}

		await this.trimOutdatedCache();
	}

	async trimOutdatedCache(): Promise<void> {
		const _storage = await this._getStorage();
		const allFiles = await this.getAllFiles();

		for (const file of allFiles) {
			const possibleFileOnFileHost = _storage.root.navigate(file.relativePath);
			if (!possibleFileOnFileHost) {
				// The file doesn't exist on the server so ensure it isn't on the client too
				await hfs.delete(convertPathToString(file.path));
			}
		}

		this.clearDirContentCache();
		this.clearDirectoryStatsCache();
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

	async deleteFile(
		file: RelativeFilePath,
		permanent = false,
	): Promise<boolean> {
		const _storage = await this._getStorage();
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
		const _storage = await this._getStorage();
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
