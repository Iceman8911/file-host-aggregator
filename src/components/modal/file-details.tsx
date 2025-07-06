import { createAsync } from "@solidjs/router";
import { createMemo, Show, Suspense } from "solid-js";
import {
	FileHost,
	type FileHostFile,
	type FileHostImplementations,
} from "~/classes/file-host";
import { convertPathToString } from "~/declarations/functions";
import { GenericModal } from "./modal";

type FileDetailsProps = {
	name: string;
	/** Size in bytes, KB, MB, GB, etc */
	size: string;
	path: string;
	dateCreated: Date;
	url: URL | null;
};

/** Displays the relevant data of a given `FileHostFile` of `FileHost` */
export default function FileDetails(prop: {
	file: FileHostFile | FileHostImplementations;
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
		const fileData = prop.file;

		if (fileData instanceof FileHost) {
			return {
				dateCreated: fileData.dateCreated,
				name: fileData.name,
				path: "/",
				size: convertBytes(await fileData.spaceUsed()),
				url: null,
			};
		}
		// else if (fileData instanceof FileHostFile) {
		else {
			return {
				dateCreated: fileData.dateCreated,
				name: fileData.name(true),
				path: convertPathToString(fileData.relativePath),
				size: convertBytes(fileData.size),
				url: fileData.url,
			};
		}
	});

	const displayedData = createAsync(() => data());

	return (
		<GenericModal modalId={prop.modalId}>
			<div class="flex flex-col gap-2">
				<h2 class="text-lg font-semibold">File Details</h2>
				<div class="flex flex-col gap-1">
					<Suspense>
						<Show when={displayedData()}>
							{(val) => (
								<>
									<span>
										<strong>Name:</strong> {val().name}
									</span>
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
