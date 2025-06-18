import { gEnumFileHost } from "~/declarations/enums";
import { FileHost } from "./file-host";

class MegaSyncFileHost extends FileHost<gEnumFileHost.MEGA> {
  type = gEnumFileHost.MEGA;

  constructor(...args: ConstructorParameters<typeof FileHost>) {
    super(...args);
  }
}
