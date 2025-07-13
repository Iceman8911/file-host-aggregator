import { For, Suspense } from "solid-js";
import LoadingSpinner from "~/components/loading-spinner";
import CustomContextMenu from "~/components/menu/custom-context-menu";
import type { FilesOrDirectoriesOrFileHosts } from "~/types/file-view";
import { getCommonPropsFromFileOrFileHostOrDirectory } from "~/utils/file-directory-file-host/file-directory-file-host";
import { FileView_ContextMenu } from "../context-menu/context-menu";
import { FileView_SpaceUsedPercentageRadialBar } from "../context-menu/space-used-radial-bar";
import { FileView_Thumbnail } from "../context-menu/thumbnail";
import { FileView_Shared } from "../file-view";

export function FileView_Grid2Layout(prop: {
	list: FilesOrDirectoriesOrFileHosts | undefined;
}) {
	return (
		<div class="col-[1_/_3] flex flex-wrap place-content-start gap-4 md:gap-8 p-4 select-none overflow-y-auto">
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
									class="relative group flex flex-col justify-center items-center w-22 md:w-27 lg:w-30 h-fit aspect-square btn btn-primary btn-soft text-xs sm:text-sm"
									title={name}
									onClick={() =>
										FileView_Shared.handleOpenFileOrDirectoryOrFileHost(
											val,
										)
									}
								>
									<div class="relative size-fit *:first:size-16">
										<FileView_Thumbnail data={val} />
									</div>

									<p class="font-bold [word-break:auto-phrase] h-16 overflow-hidden text-ellipsis w-full">
										{name}
									</p>

									<FileView_SpaceUsedPercentageRadialBar data={val} />
								</button>
							</CustomContextMenu>
						);
					}}
				</For>
			</Suspense>
		</div>
	);
}
