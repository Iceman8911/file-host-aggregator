import { Entries } from "@solid-primitives/keyed";
import { createSignal, Match, Show, Switch } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Dynamic } from "solid-js/web";
import { gFileHosts } from "~/declarations/enums";
import { gFileHostIcons } from "~/declarations/icons";
import { closeModal, GenericModal } from "./modal";

type FileHostInitData = {
	email: string;
	name: string;
	password: string;
};

export default function CreateFileHostModal(prop: { modalId: string }) {
	const { MEGA } = gFileHosts;
	const DEFAULT_FILE_HOST_INIT_DATA: FileHostInitData = {
		email: "",
		name: "",
		password: "",
	};

	const [selectedFileHost, setSelectedFileHost] =
		createSignal<gFileHosts | null>(null);
	const [fileHostInitData, setFileHostInitData] = createStore<FileHostInitData>(
		DEFAULT_FILE_HOST_INIT_DATA,
	);
	const [isInitializingFileHost, setIsInitializingFileHost] =
		createSignal(false);

	let createFileHostForm!: HTMLFormElement;

	return (
		<GenericModal modalId={prop.modalId}>
			<h3 class="font-bold text-xl mb-2">Initialize a File Host</h3>

			<p class="mb-3">Choose a supported file host:</p>

			<ul class="menu menu-horizontal bg-base-200 rounded-box">
				<Entries of={gFileHostIcons}>
					{(key, val) => (
						<li>
							<button
								type="button"
								class={`flex flex-col gap-1 items-center ${selectedFileHost() === key ? "menu-active" : ""}`}
								onClick={(_) => {
									setSelectedFileHost(key);
								}}
							>
								<Dynamic component={val()} class="size-12" />
								<div class="font-bold ">{key.toUpperCase()}</div>
							</button>
						</li>
					)}
				</Entries>
			</ul>

			<Show when={selectedFileHost()}>
				{(fileHost) => (
					<form class="mt-6" ref={createFileHostForm}>
						<fieldset class="fieldset bg-base-200 border-base-300 rounded-box w-xs border p-4 mx-auto max-w-fit">
							<legend class="fieldset-legend mx-auto">
								Required Data and Credentials
							</legend>

							{/* Grid wrapper */}
							<div class="grid grid-cols-2 gap-4">
								{/* Name of the file host */}
								<div class="col-span-2">
									<label class="label" for="fileHostName">
										Name
									</label>
									<input
										name="fileHostName"
										type="text"
										class="input input-primary"
										placeholder={fileHost()}
										required
										onInput={({ currentTarget: { value } }) =>
											setFileHostInitData(
												produce((state) => {
													state.name = value;
												}),
											)
										}
									/>
								</div>

								<Switch>
									<Match when={fileHost() === MEGA}>
										{/* Email */}
										<div>
											<label class="label" for="fileHostUsername">
												Email
											</label>
											<input
												name="fileHostUsername"
												type="email"
												class="input input-primary"
												placeholder="foo-bar@baz.com"
												required
												onInput={({ currentTarget: { value } }) =>
													setFileHostInitData(
														produce((state) => {
															state.email = value;
														}),
													)
												}
											/>
										</div>

										{/* Password */}
										<div>
											<label class="label" for="fileHostPassword">
												Password
											</label>
											<input
												name="fileHostPassword"
												type="password"
												class="input input-primary"
												required
												onInput={({ currentTarget: { value } }) =>
													setFileHostInitData(
														produce((state) => {
															state.password = value;
														}),
													)
												}
											/>
										</div>
									</Match>
								</Switch>

								<button
									type="button"
									class="btn btn-primary btn-soft mt-4 col-span-2"
									onClick={async (_) => {
										if (createFileHostForm.reportValidity()) {
											setIsInitializingFileHost(true);

											switch (fileHost()) {
												case gFileHosts.MEGA: {
													const { MegaSyncFileHost } = await import(
														"./../../classes/mega-sync"
													);
													const { email, name, password } = fileHostInitData;
													await MegaSyncFileHost.init({
														email,
														name,
														password,
														restore: false,
													});
													break;
												}
											}

											setIsInitializingFileHost(false);
											createFileHostForm.reset();
											setFileHostInitData(DEFAULT_FILE_HOST_INIT_DATA);
											closeModal(prop.modalId);
										}
									}}
								>
									Create
								</button>
							</div>
						</fieldset>
					</form>
				)}
			</Show>

			{/* Loading mode after attempting to initialize a file host */}
			<Show when={isInitializingFileHost()}>
				<div class="absolute top-0 left-0 size-full bg-black opacity-50 flex justify-center items-center">
					<span class="loading loading-spinner loading-xl text-primary"></span>
				</div>
			</Show>
		</GenericModal>
	);
}
