import CloudIcon from "lucide-solid/icons/cloud";
import ClosedFolderIcon from "lucide-solid/icons/folder-closed";
import OpenedFolderIcon from "lucide-solid/icons/folder-open";
import HardDriveIcon from "lucide-solid/icons/hard-drive";
import { For, Show } from "solid-js";
import { produce, type SetStoreFunction } from "solid-js/store";
import type { FileView_Settings } from "~/types/file-view";
import { FileView_Shared } from "./file-view";

/** For displaying the current path the user is viewing as an interactive breadcrumbs bar */
export function FileView_DirectoryPathBar(prop: {
	pathData: FileView_Settings["pathData"];
	setter: SetStoreFunction<FileView_Settings>;
}) {
	/**
	 * @param pathIndex The index of the path to navigate to in the `relativePath` array.
	 */
	const handleNavigateToPath = (pathIndex: number) => {
		prop.setter(
			produce((state) => {
				state.pathData.relativePath = state.pathData.relativePath.slice(
					0,
					pathIndex + 1,
				);
			}),
		);
	};

	return (
		<div class="breadcrumbs text-sm sm:text-[1.025rem] px-4 text-primary overflow-y-clip scrollbar-thin select-none">
			<ul class="*:last:font-bold">
				<li>
					<button
						type="button"
						onClick={FileView_Shared.handleNavigateToFileHostsView}
					>
						<CloudIcon />
						File Hosts
					</button>
				</li>

				<Show when={prop.pathData.fileHost}>
					{(fileHost) => {
						const relativePath = () => prop.pathData.relativePath;

						return (
							<>
								<li>
									<button
										type="button"
										onClick={FileView_Shared.handleNavigateToFileHostRoot}
									>
										<HardDriveIcon />
										{fileHost().name}
									</button>
								</li>

								<For each={relativePath()}>
									{(pathFragment, index) => (
										<li>
											<Show
												// Don't apply to the last list item
												when={relativePath().length - 1 !== index()}
												fallback={
													<div class="flex gap-2 place-items-center">
														<ClosedFolderIcon />
														{pathFragment}
													</div>
												}
											>
												<button
													type="button"
													onClick={() => handleNavigateToPath(index())}
												>
													<OpenedFolderIcon />
													{pathFragment}
												</button>
											</Show>
										</li>
									)}
								</For>
							</>
						);
					}}
				</Show>
			</ul>
		</div>
	);
}
