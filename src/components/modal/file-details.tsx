import { createAsync } from "@solidjs/router";
import { createMemo, Show, Suspense } from "solid-js";
import {
	FileHost,
	FileHostFile,
	type FileOrDirectoryOrFileHost,
} from "~/classes/file-host";
import { convertPathToString } from "~/declarations/functions";
import LoadingSpinner from "../loading-spinner";
import { GenericModal } from "./modal";

type FileDetailsProps = {
	name: string;
	/** Size in bytes, KB, MB, GB, etc */
	size: string;
	path: string;
	dateCreated: Date;
	url: URL | null;
	type: "File Host" | "Folder" | "File";
};

/** Displays the relevant data of a given `FileHostFile` of `FileHost` */
export default function FileDetails(prop: {
	file: FileOrDirectoryOrFileHost;
	modalId: string;
}) {
	/** To convert a number in bytes to kb, mb, gb */
	const convertBytes = (bytes: number) => {
		if (bytes < 1024) return `${bytes} bytes` as const;
		else if (bytes < 1024 * 1024)
			return `${(bytes / 1024).toFixed(2)} KB` as const;
		else if (bytes < 1024 * 1024 * 1024)
			return `${(bytes / (1024 * 1024)).toFixed(2)} MB` as const;
		else return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB` as const;
	};

	const data = createMemo<Promise<FileDetailsProps>>(async () => {
		const data = prop.file;

		if (data instanceof FileHost) {
			return {
				dateCreated: data.dateCreated,
				name: data.name,
				path: "/",
				size: convertBytes(await data.spaceUsed()),
				type: "File Host",
				url: null,
			};
		} else if (data instanceof FileHostFile) {
			return {
				dateCreated: data.dateCreated,
				name: data.name(true),
				path: convertPathToString(data.relativePath),
				size: convertBytes(data.size),
				type: "File",
				url: data.url,
			};
		} else {
			return {
				dateCreated: data.dateEdited,
				name: data.name,
				// TODO: add a central function for getting relative paths instead of this hacky workaround that may break if I change the logic in the future
				path: convertPathToString(data.path.slice(2)),
				size: convertBytes(data.size),
				type: "Folder",
				url: null,
			};
		}
	});

	const displayedData = createAsync(() => data());

	return (
		<GenericModal modalId={prop.modalId}>
			<div class="flex flex-col gap-2 break-words">
				<h2 class="text-lg font-semibold">Details</h2>
				<div class="flex flex-col gap-1">
					<Suspense fallback={<LoadingSpinner />}>
						<Show when={displayedData()}>
							{(val) => (
								<>
									<span>
										<strong>Name:</strong> {val().name}
									</span>

									<span>
										<strong>Type:</strong> {val().type}
									</span>

									<Show when={val().url}>
										{(val) => (
											<span>
												<strong>URL:</strong>{" "}
												<a
													href={val().toString()}
													target="_blank"
													rel="noopener noreferrer"
													class="link link-primary"
												>
													{val().toString()}
												</a>
											</span>
										)}
									</Show>

									<span>
										<strong>Size:</strong> {val().size}
									</span>

									<span>
										<strong>Path:</strong> {val().path}
									</span>

									<span>
										<strong>Date Created:</strong>{" "}
										{val().dateCreated.toLocaleDateString()}
									</span>
								</>
							)}
						</Show>
					</Suspense>
				</div>
			</div>
		</GenericModal>
	);
}
