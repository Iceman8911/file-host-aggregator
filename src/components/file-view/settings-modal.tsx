import { For } from "solid-js";
import { produce, type SetStoreFunction } from "solid-js/store";
import type { FileView_Settings } from "~/types/file-view";
import { GenericModal } from "../modal/modal";

export function FileView_SettingsModal(prop: {
	modalId: string;
	settings: FileView_Settings;
	setSettings: SetStoreFunction<FileView_Settings>;
}) {
	const displayModeRadioBtnName = "file-view-display-mode";
	const sortParamRadioBtnName = "file-view-sort-param";
	const sortDirectionRadioBtnName = "file-view-sort-direction";

	function DisplayModeRadioBtns() {
		const options = [
			{ name: "Grid-1", value: "grid-1" },
			{ name: "Grid-2", value: "grid-2" },
			{ name: "List", value: "list" },
			{ name: "Columned", value: "columned" },
			{ name: "Minimal", value: "minimal" },
		] as const satisfies ReadonlyArray<{
			name: Capitalize<FileView_Settings["mode"]>;
			value: FileView_Settings["mode"];
		}>;

		return (
			<div class="flex flex-col gap-2">
				<div class="font-semibold">Display Mode:</div>

				<div class="flex gap-4 flex-wrap **:[_input]:ml-2">
					<For each={options}>
						{({ name, value }) => {
							const isSelected = () => value === prop.settings.mode;

							return (
								<label>
									{name}
									<input
										type="radio"
										name={displayModeRadioBtnName}
										class={`radio ${isSelected() ? "radio-primary" : "radio-secondary"}`}
										checked={isSelected()}
										onInput={(_) =>
											prop.setSettings(
												produce((state) => {
													state.mode = value;
												}),
											)
										}
									/>
								</label>
							);
						}}
					</For>
				</div>
			</div>
		);
	}

	function SortParamRadioBtns() {
		const options = [
			{ name: "Date", value: "date" },
			{ name: "Name", value: "name" },
			{ name: "Size", value: "size" },
			{ name: "Type", value: "type" },
		] as const satisfies ReadonlyArray<{
			name: Capitalize<FileView_Settings["sorting"]["param"]>;
			value: FileView_Settings["sorting"]["param"];
		}>;

		return (
			<div class="flex flex-col gap-2">
				<div class="font-semibold">Sorting Mode:</div>

				<div class="flex gap-4 flex-wrap **:[_input]:ml-2">
					<For each={options}>
						{({ name, value }) => {
							const isSelected = () => value === prop.settings.sorting.param;

							return (
								<label>
									{name}
									<input
										type="radio"
										name={sortParamRadioBtnName}
										class={`radio ${isSelected() ? "radio-primary" : "radio-secondary"}`}
										checked={isSelected()}
										onInput={(_) =>
											prop.setSettings(
												produce((state) => {
													state.sorting.param = value;
												}),
											)
										}
									/>
								</label>
							);
						}}
					</For>
				</div>
			</div>
		);
	}

	function SortDirectionRadioBtns() {
		const options = [
			{ name: "Ascending", value: "asc" },
			{ name: "Descending", value: "desc" },
		] as const satisfies ReadonlyArray<{
			name: string;
			value: FileView_Settings["sorting"]["order"];
		}>;

		return (
			<div class="flex flex-col gap-2">
				<div class="font-semibold">Sorting Direction:</div>

				<div class="flex gap-4 flex-wrap **:[_input]:ml-2">
					<For each={options}>
						{({ name, value }) => {
							const isSelected = () => value === prop.settings.sorting.order;

							return (
								<label>
									{name}
									<input
										type="radio"
										name={sortDirectionRadioBtnName}
										class={`radio ${isSelected() ? "radio-primary" : "radio-secondary"}`}
										checked={isSelected()}
										onInput={(_) =>
											prop.setSettings(
												produce((state) => {
													state.sorting.order = value;
												}),
											)
										}
									/>
								</label>
							);
						}}
					</For>
				</div>
			</div>
		);
	}

	return (
		<GenericModal modalId={prop.modalId}>
			<h3 class="font-bold text-xl mb-4">File View Settings</h3>

			{/* <p class="mb-3">
				This is where you can change how the files and folders are displayed.
			</p> */}

			<div class="flex flex-col gap-4">
				<DisplayModeRadioBtns />

				<SortParamRadioBtns />

				<SortDirectionRadioBtns />
			</div>
		</GenericModal>
	);
}
