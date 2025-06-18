import { gEnumFileHost } from "~/declarations/enums";

/** Every file host (e.g Mega, MediaFire, etc) must implement this */
export abstract class FileHost<TFileHost extends gEnumFileHost> {
  dateCreated = new Date();
  abstract readonly type: TFileHost;

  constructor(public name: string) {}

  abstract getFiles: () => {};
}
