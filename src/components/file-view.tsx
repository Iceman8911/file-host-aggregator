import HardDriveIcon from "lucide-solid/icons/hard-drive";
import { createSignal, For } from "solid-js";
import { Dynamic } from "solid-js/web";
import { FileHost } from "~/classes/file-host";
import { gFileHostIcons } from "~/declarations/icons";

export default function FileView() {
	const fileHosts = FileHost.collection;

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
				<For each={Array.from(fileHosts)}>
					{([_, fileHost]) => {
						const { name, type } = fileHost;

						return (
							<button
								type="button"
								class="flex flex-col justify-center items-center size-fit"
							>
								<div class="relative size-fit">
									<HardDriveIcon class="size-16" />
									<Dynamic
										component={gFileHostIcons[type]}
										class="absolute right-0 bottom-0 size-6"
									/>
								</div>

								<p class="font-bold">{name}</p>
							</button>
						);
					}}
				</For>
			</div>
		</div>
	);
}
