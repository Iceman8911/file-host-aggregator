import type { MutableFile } from "megajs";
import { gFileHosts } from "~/declarations/enums";
import {
	gIsUserConnectedToInternet,
	gThrowIfNoInternet,
} from "~/declarations/functions";
import type {
	ClassPropsOnly,
	FilePath,
	ResultType,
} from "~/declarations/types";
import { DEFAULT_FILE_NAME, ROOT_PATH } from "~/declarations/variables";
import { FileHost, FileHostFile } from "./file-host";

const { Storage: MegaSyncStorage } = await import("megajs");

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

		await instance.downloadFiles(true);

		return instance;
	}

	async uploadFile(
		file: Blob,
		path: FilePath,
		name: string,
	): Promise<ResultType<URL>> {
		try {
			const { _storage } = this;
			if (!_storage) throw Error("Mega storage not initialized");

			const folder =
				_storage.find((file) => file.name === path) ??
				(await _storage.mkdir(path));
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

	async downloadFiles(getMetadataOnly = false): Promise<void> {
		const { _storage } = this;
		if (!_storage) return;

		// Get references to all the files
		const fileRefs = _storage.filter((_) => true);

		// TODO: Depending on the file size, use a stream
		const downloadFileContent = async (
			file: MutableFile,
			onlyMetaData = true,
		) => {
			if (onlyMetaData) return undefined;

			return new Blob([await file.downloadBuffer({})]);
		};

		for (const ref of fileRefs) {
			// console.log(ref);

			// It's a file at the root level
			if (!ref.directory) {
				await FileHostFile.init({
					fileData: await downloadFileContent(ref, getMetadataOnly),
					fileHostId: this.id,
					fileUrl: await ref.link({ noKey: true }),
					name: ref.name ?? DEFAULT_FILE_NAME,
					relativePath: ROOT_PATH,
				});
			} else {
				type FileAndPath = { file: MutableFile; relativePath: FilePath };

				// Recursively loop through it's children until we find the files.
				const searchForNestedFiles = (
					possibleDirectory: MutableFile,
					pathAccumulator: FilePath,
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
							`${pathAccumulator}/${nestedFileOrDirectory.name}`,
							foundFiles,
						);
					});
				};

				searchForNestedFiles(ref, `${ROOT_PATH}${ref.name}`).forEach(
					async ({ file, relativePath }) => {
						await FileHostFile.init({
							fileData: await downloadFileContent(file, getMetadataOnly),
							fileHostId: this.id,
							fileUrl: await file.link({ noKey: true }),
							name: file.name ?? DEFAULT_FILE_NAME,
							relativePath,
						});
					},
				);
			}
		}
	}
}
