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
import { FileHost } from "./file-host";

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
		instance.save();
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

	// getFiles() {
	// 	return {};
	// }
}
