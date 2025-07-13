import type { MEGASyncFileHost } from "~/classes/mega-sync";
import type { Brand } from "../generics";
import type { UUID } from "../path";


export type FileHostID = Brand<UUID, "FileHostID">;
export type FileHostImplementations = MEGASyncFileHost;
export type FileHostClassProps = ReturnType<FileHostImplementations["export"]>;
