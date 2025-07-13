import type { JSX } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import { Dynamic } from "solid-js/web";
import type {
	FilesOrDirectoriesOrFileHosts,
	FileView_Settings,
} from "~/types/file-view";
import { FileView_ColumnedLayout } from "./layouts/column";
import { FileView_Grid1Layout } from "./layouts/grid-1";
import { FileView_Grid2Layout } from "./layouts/grid-2";
import { FileView_ListLayout } from "./layouts/list";
import { FileView_MinimalLayout } from "./layouts/minimal";

export function FileView_ListOfFilesAndFoldersAndFileHosts(prop: {
	list: FilesOrDirectoriesOrFileHosts | undefined;
	settings: FileView_Settings;
	settingsSetter: SetStoreFunction<FileView_Settings>;
}) {
	const modeAndLayout = {
		"grid-1": FileView_Grid1Layout,
		"grid-2": FileView_Grid2Layout,
		list: FileView_ListLayout,
		minimal: FileView_MinimalLayout,
		columned: FileView_ColumnedLayout,
	} as const satisfies Record<
		typeof prop.settings.mode,
		(...args: never[]) => JSX.Element
	>;

	return (
		<Dynamic component={modeAndLayout[prop.settings.mode]} list={prop.list} />
	);
}
