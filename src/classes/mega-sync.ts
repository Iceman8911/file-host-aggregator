import { gFileHosts } from "~/declarations/enums";
import { FileHost } from "./file-host";

export class MegaSyncFileHost extends FileHost {
	type = gFileHosts.MEGA;

	constructor(...args: ConstructorParameters<typeof FileHost>) {
		super(...args);
	}

	// getFiles() {
	// 	return {};
	// }
}
