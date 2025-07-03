import { createAsync } from "@solidjs/router";
import HardDriveIcon from "lucide-solid/icons/hard-drive";
import { createSignal, For, Show, Suspense } from "solid-js";
import { produce } from "solid-js/store";
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
			return gFilePathTracker.fileHost.getDirContents(gFilePathTracker.path);

		return Promise.resolve(Array.from(FileHost.collection.values()));
	});

	const [iconSize, setIconSize] = createSignal<"XS" | "S" | "M" | "L" | "XL">(
		"M",
	);
	const iconSizeVal = () => {
		switch (iconSize()) {
			case "XS":
				return 7;
			case "S":
				return 6;
			case "M":
				return 5;
			case "L":
				return 4;
			case "XL":
				return 3;
		}
	};

	return (
		<div class="flex flex-col gap-8 p-4 size-full *:bg-base-200 *:rounded-field *:w-full">
			{/* Breadcrumbs bar */}
			<div class="h-10"></div>

			{/* Folder/File view */}
			<div class="grow flex flex-wrap place-content-start gap-4 md:gap-8 p-4 select-none overflow-y-auto">
				<Suspense>
					<For each={filesOrFileHosts()}>
						{(val) => {
							return (
								<button
									type="button"
									class="flex flex-col justify-center items-center size-fit btn btn-primary btn-soft"
									onClick={(_) => {
										gSetFilePathTracker(
											produce((state) => {
												if (val instanceof FileHost) {
													state.fileHost = val;
													state.path = ROOT_PATH;
												} else {
													state.path +=
														val.type === "dir"
															? `${state.path}/${val.name}`
															: val.file.path;
												}
											}),
										);
									}}
								>
									<div class="relative size-fit">
										<HardDriveIcon class="size-16" />
										<Show when={val instanceof FileHost}>
											<Dynamic
												component={gFileHostIcons[(val as FileHost).type]}
												class="absolute right-0 bottom-0 size-6 opacity-75"
											/>
										</Show>
									</div>

									<p class="font-bold">
										{val.type === "file" ? val.file.name() : val.name}
									</p>
								</button>
							);
						}}
					</For>
				</Suspense>
			</div>
		</div>
	);
}
