import type { MutableFile } from "megajs";
import { gFileHosts } from "~/declarations/enums";
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
		private _storage: typeof MegaSyncStorage.prototype,
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
		try {
			const { email, name, password } = arg;
			const storage = await new MegaSyncStorage({
				email,
				password,
				userAgent: "FileHostAggregator/0.1",
			}).ready;

			const instance = new MegaSyncFileHost(name, email, password, storage);

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
		} catch (_) {
			alert("Invalid Mega Sync Credentials");
			return null;
		}
	}

	async uploadFile(
		file: Blob,
		path: FilePath,
		name: string,
	): Promise<ResultType<URL>> {
		try {
			const folder =
				this._storage.find((file) => file.name === path) ??
				(await this._storage.mkdir(path));
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
