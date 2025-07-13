import { For, Suspense } from "solid-js";
import LoadingSpinner from "~/components/loading-spinner";
import CustomContextMenu from "~/components/menu/custom-context-menu";
import type { FilesOrDirectoriesOrFileHosts } from "~/types/file-view";
import { getCommonPropsFromFileOrFileHostOrDirectory } from "~/utils/file-directory-file-host/file-directory-file-host";
import { FileView_ContextMenu } from "../context-menu/context-menu";
import { FileView_Shared } from "../file-view";

export function FileView_MinimalLayout(prop: {
	list: FilesOrDirectoriesOrFileHosts | undefined;
}) {
	return (
		<div class="col-[1_/_3] flex flex-wrap place-content-start gap-4 md:gap-8 p-4 select-none overflow-y-auto">
			<Suspense fallback={<LoadingSpinner />}>
				<For each={prop.list}>
					{(val) => {
						const data = getCommonPropsFromFileOrFileHostOrDirectory(val);
						const name = data.name;

						return (
							<CustomContextMenu
								closeOnClick={true}
								contextMenu={<FileView_ContextMenu data={val} />}
							>
								<button
									type="button"
									class="relative group flex flex-col justify-center items-center w-30 lg:w-35 h-fit aspect-video btn btn-ghost text-primary p-0 text-sm"
									title={name}
									onClick={() =>
										FileView_Shared.handleOpenFileOrDirectoryOrFileHost(val)
									}
								>
									<p class="font-bold overflow-clip text-ellipsis [word-break:auto-phrase] size-full">
										{name}
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
