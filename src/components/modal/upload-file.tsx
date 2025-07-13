import { createAsync } from "@solidjs/router";
import FileIcon from "lucide-solid/icons/file";
import { createMemo, createSignal, For, Show, Suspense } from "solid-js";
import { createStore } from "solid-js/store";
import { FileHost } from "~/classes/file-host";
import { ROOT_PATH } from "~/shared/constants";
import type { FileHostImplementations } from "~/types/file-directory-file-host/file-host";
import type {
	AbsoluteDirectoryPath,
	FileName,
	RelativeDirectoryPath,
} from "~/types/path";
import { treatStringAsFileName } from "~/utils/file-name";
import {
	convertPathToString,
	convertStringToPath,
	isDirectoryPath,
	isRelativePath,
} from "~/utils/path";
import LoadingSpinner from "../loading-spinner";
import { closeModal, GenericModal } from "./modal";

export default function UploadFileModal(prop: {
	/** If given, it's used to set the intial file host and directory to upload to, otherwise the fields are empty */
	defaultDirectory: AbsoluteDirectoryPath | null;
	modalId: string;
}) {
	const fileHostAndRelativePathFromProp = () =>
		prop.defaultDirectory
			? {
					fileHost: FileHost.getFileHostFromAbsolutePath(prop.defaultDirectory),
					relativePath: FileHost.getRelativePathFromAbsolutePath(
						prop.defaultDirectory,
					),
				}
			: null;

	const fileHostFromProp = () => fileHostAndRelativePathFromProp()?.fileHost;
	const relativePathFromProp = () =>
		fileHostAndRelativePathFromProp()?.relativePath;

	type UploadFileData = {
		fileHost: FileHostImplementations | null;
		relativePath: RelativeDirectoryPath | null;
		file: Blob | null;
		name: FileName | null;
	};
	const [uploadFileData, setUploadFileData] = createStore<UploadFileData>({
		file: null,
		fileHost: null,
		name: null,
		relativePath: null,
	});

	function emptyUploadFileData() {
		setUploadFileData({
			fileHost: null,
			relativePath: null,
			file: null,
			name: null,
		} satisfies UploadFileData);
	}

	const fileHostAndRelativePathToUse = createMemo(() => {
		return {
			fileHost: uploadFileData.fileHost ?? fileHostFromProp(),
			relativePath: uploadFileData.relativePath ?? relativePathFromProp(),
		};
	});

	const [isUploadingFile, setIsUploadingFile] = createSignal(false);

	function FileHostSelectField() {
		return (
			<fieldset class="fieldset">
				<legend class="fieldset-legend">File Host</legend>
				<select
					class="select select-primary"
					required
					onInput={({ target: { value: hostId } }) => {
						setUploadFileData({ fileHost: FileHost.getInstanceFromId(hostId) });
					}}
				>
					<option disabled selected={!fileHostAndRelativePathToUse().fileHost}>
						Pick an existing file host
					</option>

					<For each={Array.from(FileHost.collection)}>
						{([_, host]) => (
							<option
								selected={
									fileHostAndRelativePathToUse().fileHost?.id === host.id
								}
								value={host.id}
							>
								{host.name}
							</option>
						)}
					</For>
				</select>
				<span class="label">Required</span>
			</fieldset>
		);
	}

	function PathSelectField() {
		return (
			<Show when={fileHostAndRelativePathToUse().fileHost}>
				{(fileHost) => {
					const directories = createAsync(() => fileHost().getAllDirectories());

					return (
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Relative Path</legend>
							<select
								class="select select-primary"
								required
								onInput={({
									target: { value: relativeDirectoryPathString },
								}) => {
									const untestedPath = convertStringToPath(
										relativeDirectoryPathString,
									);

									if (
										isRelativePath(untestedPath) &&
										isDirectoryPath(untestedPath)
									) {
										const testedPath: RelativeDirectoryPath = untestedPath;
										setUploadFileData({
											relativePath: testedPath,
										});
									}
								}}
							>
								<option
									disabled
									selected={
										!fileHostAndRelativePathToUse().relativePath?.length
									}
									value={convertPathToString(ROOT_PATH)}
								>
									Choose a directory to upload to
								</option>

								<Suspense>
									<For each={directories.latest}>
										{(dir) => {
											const iteratedDirRelativePathString = () =>
												convertPathToString(
													FileHost.getRelativePathFromAbsolutePath(dir.path),
												);
											const relativePathToUseString = () =>
												convertPathToString(
													fileHostAndRelativePathToUse().relativePath ??
														ROOT_PATH,
												);

											return (
												<option
													selected={
														relativePathToUseString() ===
														iteratedDirRelativePathString()
													}
													value={iteratedDirRelativePathString()}
												>
													{iteratedDirRelativePathString()}
												</option>
											);
										}}
									</For>
								</Suspense>
							</select>
							<span class="label">Required</span>
						</fieldset>
					);
				}}
			</Show>
		);
	}

	function FileInputField() {
		const inputName = "upload-file-input";
		return (
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Pick a file</legend>
				<input
					type="file"
					class="file-input file-input-primary"
					name={inputName}
					required
					onInput={({ target: { files } }) => {
						setUploadFileData({ file: files?.item(0) });
					}}
				/>
				<label class="label" for={inputName}>
					Required
				</label>
			</fieldset>
		);
	}

	function FileNameField() {
		return (
			<fieldset class="fieldset">
				<legend class="fieldset-legend">File Name</legend>
				<label class="input input-primary">
					<FileIcon class="size-6" stroke-width={0.5} />
					<input
						type="text"
						required
						placeholder="File Name"
						onInput={({ target: { value } }) =>
							setUploadFileData({ name: treatStringAsFileName(value) })
						}
					/>
				</label>
				<p class="label">Required</p>
			</fieldset>
		);
	}

	function UploadAndCancelButtons() {
		function resetFormData() {
			uploadForm.reset();
			emptyUploadFileData();
		}
		return (
			<div class="flex justify-end gap-2">
				<button type="button" class="btn btn-secondary" onClick={resetFormData}>
					Reset
				</button>
				<button
					type="submit"
					class="btn btn-primary"
					onClick={async (e) => {
						e.preventDefault();

						if (uploadForm.reportValidity()) {
							setIsUploadingFile(true);
							// Incase the user used the predefined path and filehost without changing them
							setUploadFileData({
								fileHost: fileHostAndRelativePathToUse().fileHost,
								relativePath: fileHostAndRelativePathToUse().relativePath,
							});

							const { file, fileHost, name, relativePath } = uploadFileData;
							if (file && fileHost && name && relativePath) {
								await fileHost.uploadFile(file, relativePath, name);
							}

							// Reset the form after upload
							resetFormData();
							setIsUploadingFile(false);
							closeModal(prop.modalId);
						}
					}}
				>
					Upload
				</button>
			</div>
		);
	}

	let uploadForm!: HTMLFormElement;

	return (
		<GenericModal modalId={prop.modalId}>
			<h3 class="text-2xl font-bold"> Upload File </h3>

			<Show
				when={FileHost.collection.size}
				fallback={
					<p class="text-error text-lg">
						You have no file hosts available. Please create one first.
					</p>
				}
			>
				<form class="grid grid-cols-2 grid-rows-2 gap-4 my-4" ref={uploadForm}>
					<FileHostSelectField />

					<PathSelectField />

					<FileInputField />

					<FileNameField />
				</form>

				<UploadAndCancelButtons />
			</Show>

			{/* Loading mode after attempting to initialize a file host */}
			<Show when={isUploadingFile()}>
				<div class="absolute top-0 left-0 size-full bg-black opacity-50 flex justify-center items-center">
					<LoadingSpinner />
				</div>
			</Show>
		</GenericModal>
	);
}
