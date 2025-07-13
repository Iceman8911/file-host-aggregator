import { createAsync } from "@solidjs/router";
import { For, Suspense } from "solid-js";
import LoadingSpinner from "~/components/loading-spinner";
import CustomContextMenu from "~/components/menu/custom-context-menu";
import type { FilesOrDirectoriesOrFileHosts } from "~/types/file-view";
import { getCommonPropsFromFileOrFileHostOrDirectory } from "~/utils/file-directory-file-host/file-directory-file-host";
import { convertDateToLegibleString } from "~/utils/other";
import { FileView_ContextMenu } from "../context-menu/context-menu";
import { FileView_Thumbnail } from "../context-menu/thumbnail";
import { FileView_Shared } from "../file-view";

export function FileView_ListLayout(prop: {
	list: FilesOrDirectoriesOrFileHosts | undefined;
}) {
	return (
		<div class="col-[1_/_3] grid grid-cols-1 auto-rows-[4.5rem] gap-2 md:gap-4 p-4 select-none overflow-y-auto">
			<Suspense fallback={<LoadingSpinner />}>
				<For each={prop.list}>
					{(val) => {
						const data = getCommonPropsFromFileOrFileHostOrDirectory(val);

						const name = data.name;
						const date = convertDateToLegibleString(data.dateCreated);
						const size = createAsync(() => Promise.resolve(data.size));

						return (
							<CustomContextMenu
								closeOnClick={true}
								contextMenu={<FileView_ContextMenu data={val} />}
							>
								<button
									type="button"
									class="relative group px-2 grid grid-cols-[20%_42.5%_35%] sm:grid-cols-[15%_47.5%_35%] grid-rows-[1.5fr_1fr] items-center size-full aspect-square btn btn-primary btn-soft"
									title={name}
									onClick={() =>
										FileView_Shared.handleOpenFileOrDirectoryOrFileHost(
											val,
										)
									}
								>
									<div class="relative size-fit row-span-2 *:first:size-12 md:*:first:size-16">
										<FileView_Thumbnail data={val} />
									</div>

									<p class="col-[2/4] text-left sm:text-lg font-bold overflow-clip text-ellipsis whitespace-nowrap w-full">
										{name}
									</p>

									<p class="row-[2/3] col-[2/3] text-left text-sm overflow-clip text-ellipsis whitespace-nowrap w-full">
										<Suspense fallback={<LoadingSpinner />}>
											{size.latest?.parsed}
										</Suspense>
									</p>

									<p class="row-[2/3] col-[3/4] text-right text-sm overflow-clip text-ellipsis whitespace-nowrap w-full">
										{date}
									</p>
								</button>
							</CustomContextMenu>
						);
					}}
				</For>
			</Suspense>
		</div>
	);
}
