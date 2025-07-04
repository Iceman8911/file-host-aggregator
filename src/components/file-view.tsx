import { createAsync } from "@solidjs/router";
import HardDriveIcon from "lucide-solid/icons/hard-drive";
import { createEffect, createSignal, For, Show, Suspense } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Dynamic } from "solid-js/web";
import {
	FileHost,
	type FileHostFile,
	type FileHostImplementations,
} from "~/classes/file-host";
import { gFileHostIcons } from "~/declarations/icons";
import {
	gFilePathTracker,
	gSetFilePathTracker,
	ROOT_PATH,
} from "~/declarations/variables";

export default function FileView() {
	const filesOrFileHosts = createAsync<
		| ({ type: "dir"; name: string } | { type: "file"; file: FileHostFile })[]
		| FileHostImplementations[]
		| null
	>(() => {
		if (gFilePathTracker.fileHost)
			return gFilePathTracker.fileHost.getDirContents(
				[
					gFilePathTracker.fileHost.root(),
					gFilePathTracker.relativePath,
				].flat(),
			);

		return Promise.resolve(Array.from(FileHost.collection.values()));
	});

	type FileViewSettings = {
		iconSize: "XS" | "S" | "M" | "L" | "XL";
		mode: "grid" | "list" | "wrapped" | "minimal";
	};
	const defaultFileViewSettings: Readonly<FileViewSettings> = {
		iconSize: "M",
		mode: "grid",
	};
	const [fileViewSettings, setFileViewSettings] = createStore<FileViewSettings>(
		defaultFileViewSettings,
	);

	return (
		<div class="flex flex-col gap-8 p-4 size-full *:bg-base-200 *:rounded-field *:w-full">
			{/* Breadcrumbs bar */}
			<div class="h-10"></div>

			{/* Folder/File view */}
			<div class="grow flex flex-wrap place-content-start gap-4 md:gap-8 p-4 select-none overflow-y-auto">
				<Suspense>
					<For each={filesOrFileHosts()}>
						{(val) => {
							const name = val.type === "file" ? val.file.name(true) : val.name;

							return (
								<button
									type="button"
									class="relative flex flex-col justify-center items-center w-1/6 min-w-20 h-fit aspect-square btn btn-primary btn-soft "
									title={name}
									onClick={(_) => {
										gSetFilePathTracker(
											produce((state) => {
												if (val instanceof FileHost) {
													state.fileHost = val;
													state.relativePath = ROOT_PATH;
												} else if (val.type === "dir") {
													state.relativePath = [
														state.relativePath,
														val.name,
													].flat();
												}
											}),
										);
									}}
								>
									{/* <div
										class="tooltip tooltip-bottom absolute size-full"
										data-tip={name}
									> */}
									<div class="relative size-fit">
										<HardDriveIcon class="size-16" />
										<Show when={val instanceof FileHost}>
											<Dynamic
												component={gFileHostIcons[(val as FileHost).type]}
												class="absolute right-0 bottom-0 size-6 opacity-75"
											/>
										</Show>
									</div>

									<p class="font-bold overflow-clip text-ellipsis whitespace-nowrap w-full">
										{name}
									</p>
									{/* </div> */}
								</button>
							);
						}}
					</For>
				</Suspense>
			</div>
		</div>
	);
}
