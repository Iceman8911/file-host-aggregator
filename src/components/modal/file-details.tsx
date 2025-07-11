import { createAsync } from "@solidjs/router";
import { createMemo, Show, Suspense } from "solid-js";
import {
	FileHost,
	FileHostFile,
	type FileOrDirectoryOrFileHost,
	gGetCommonPropsFromFileOrFileHostOrDirectory,
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
	const data = createMemo<Promise<FileDetailsProps>>(async () => {
		const data = gGetCommonPropsFromFileOrFileHostOrDirectory(prop.file);

		if (data.type === "file host") {
			return {
				dateCreated: data.dateCreated,
				name: data.name,
				path: data.path.legiblePath,
				size: (await data.size).parsed,
				type: "File Host",
				url: null,
			};
		} else if (data.type === "file") {
			return {
				dateCreated: data.dateCreated,
				name: data.name,
				path: data.path.legiblePath,
				size: data.size.parsed,
				type: "File",
				url: data.url,
			};
		} else {
			return {
				dateCreated: data.dateCreated,
				name: data.name,
				path: data.path.legiblePath,
				size: data.size.parsed,
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
										<strong>Path:</strong>{" "}
										<span class="text-secondary">{val().path}</span>
									</span>

									<span>
										<strong>Date Created:</strong>{" "}
										{val().dateCreated.toUTCString()}
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
