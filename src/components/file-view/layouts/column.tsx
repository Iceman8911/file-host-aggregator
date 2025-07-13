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
export function FileView_ColumnedLayout(prop: {
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
									class="relative group px-2 grid grid-cols-[15%_42.5%_15%_25%] items-center size-full aspect-square btn btn-primary btn-soft md:text-lg"
									title={name}
									onClick={() =>
										FileView_Shared.handleOpenFileOrDirectoryOrFileHost(
											val,
										)
									}
								>
									<div class="relative size-fit *:first:size-12 md:*:first:size-16">
										<FileView_Thumbnail data={val} />
									</div>

									<p class="text-left text-sm font-bold overflow-clip text-ellipsis whitespace-nowrap w-full">
										{name}
									</p>

									<p class="text-left text-sm overflow-clip text-ellipsis whitespace-nowrap w-full">
										<Suspense fallback={<LoadingSpinner />}>
											{size.latest?.parsed}
										</Suspense>
									</p>

									<p class="text-right text-sm overflow-clip text-ellipsis whitespace-nowrap w-full">
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
