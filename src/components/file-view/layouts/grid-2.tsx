import { For, Show, Suspense } from "solid-js";
import LoadingSpinner from "~/components/loading-spinner";
import CustomContextMenu from "~/components/menu/custom-context-menu";
import type { FilesOrDirectoriesOrFileHosts } from "~/types/file-view";
import { getCommonPropsFromFileOrFileHostOrDirectory } from "~/utils/file-directory-file-host/file-directory-file-host";
import { isFileHost } from "~/utils/file-directory-file-host/file-host";
import { FileView_ContextMenu } from "../context-menu/context-menu";
import { FileView_SpaceUsedPercentageRadialBar } from "../context-menu/space-used-radial-bar";
import { FileView_Thumbnail } from "../context-menu/thumbnail";
import { FileView_Shared } from "../file-view";

export function FileView_Grid2Layout(prop: {
	list: FilesOrDirectoriesOrFileHosts | undefined;
}) {
	return (
		<div class="col-[1_/_3] grid grid-cols-[repeat(auto-fit,var(--grid-sizing))] [--grid-sizing:5.5rem] sm:[--grid-sizing:6rem] md:[--grid-sizing:6.5rem] lg:[--grid-sizing:7rem] place-content-start gap-4 md:gap-8 p-4 select-none overflow-y-auto">
			<Suspense fallback={<LoadingSpinner />}>
				<For each={prop.list}>
					{(val) => {
						const name = getCommonPropsFromFileOrFileHostOrDirectory(val).name;

						return (
							<CustomContextMenu
								closeOnClick={true}
								contextMenu={<FileView_ContextMenu data={val} />}
							>
								<button
									type="button"
									class="relative group flex flex-col justify-center items-center w-22 md:w-27 lg:w-30 h-full py-2 btn btn-primary btn-soft text-xs sm:text-sm"
									title={name}
									onClick={() =>
										FileView_Shared.handleOpenFileOrDirectoryOrFileHost(val)
									}
								>
									<div class="relative size-fit *:first:size-16">
										<FileView_Thumbnail data={val} />
									</div>

									<p class="font-bold break-words h-max w-full">{name}</p>

									<Show when={isFileHost(val)}>
										{/* To prevent layout shift when the radial bar is done loading */}
										<div class="w-full h-20">
											<FileView_SpaceUsedPercentageRadialBar data={val} />
										</div>
									</Show>
								</button>
							</CustomContextMenu>
						);
					}}
				</For>
			</Suspense>
		</div>
	);
}
