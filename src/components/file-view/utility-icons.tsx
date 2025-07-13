import RefreshIcon from "lucide-solid/icons/refresh-ccw";
import SearchIcon from "lucide-solid/icons/search";
import { Show } from "solid-js";
import { produce, type SetStoreFunction } from "solid-js/store";
import type { FileView_Settings } from "~/types/file-view";

export function FileView_UtilityIcons(prop: {
	settings: FileView_Settings;
	settingsSetter: SetStoreFunction<FileView_Settings>;
}) {
	const settings = () => prop.settings;

	const handleRefreshFiles = async () => {
		if (settings().isRefreshing === true) return;

		prop.settingsSetter(
			produce(async (state) => {
				state.isRefreshing = true;

				// Refetch the data
				await state.pathData.fileHost?.downloadFiles();

				state.isRefreshing = false;
			}),
		);
	};
	/** So I can optionally hide / show some stuff when it makes sense  */
	const isViewingFileHostOnlyArea = () => !prop.settings.pathData.fileHost;

	return (
		<div class="flex gap-2 justify-center items-center *:btn *:btn-primary *:btn-soft *:btn-sm *:p-1 *:btn-circle">
			<button type="button">
				<SearchIcon />
			</button>{" "}
			<button
				type="button"
				disabled={isViewingFileHostOnlyArea()}
				onClick={handleRefreshFiles}
			>
				<Show when={settings().isRefreshing} fallback={<RefreshIcon />}>
					<span class="loading loading-spinner"></span>
				</Show>
			</button>
		</div>
	);
}
