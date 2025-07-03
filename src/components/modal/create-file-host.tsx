import { Entries } from "@solid-primitives/keyed";
import { createSignal, Match, Show, Switch } from "solid-js";
import { Dynamic } from "solid-js/web";
import { gFileHosts } from "~/declarations/enums";
import { gFileHostIcons } from "~/declarations/icons";
import { GenericModal } from "./modal";

export default function CreateFileHostModal(prop: { modalId: string }) {
	const { MEGA } = gFileHosts;

	const [selectedFileHost, setSelectedFileHost] =
		createSignal<gFileHosts | null>(null);

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
									/>
								</div>

								<Switch>
									<Match when={fileHost() === MEGA}>
										{/* Username or email */}
										<div>
											<label class="label" for="fileHostUsername">
												Username or Email
											</label>
											<input
												name="fileHostUsername"
												type="text"
												class="input input-primary"
												placeholder="foo-bar@baz.com"
												required
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
											/>
										</div>
									</Match>
								</Switch>

								<button
									type="button"
									class="btn btn-primary btn-soft mt-4 col-span-2"
									onClick={(_) => {
										if (createFileHostForm.reportValidity()) {
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
		</GenericModal>
	);
}
