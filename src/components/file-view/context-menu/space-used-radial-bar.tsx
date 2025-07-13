import { createAsync } from "@solidjs/router";
import { Show, Suspense } from "solid-js";
import { FileHost } from "~/classes/file-host";
import LoadingSpinner from "~/components/loading-spinner";
import type { FileOrDirectoryOrFileHost } from "~/types/file-directory-file-host/file-directory-file-host";

export function FileView_SpaceUsedPercentageRadialBar(prop: {
	data: FileOrDirectoryOrFileHost;
}) {
	return (
		<Show when={prop.data instanceof FileHost && prop.data}>
			{(val) => {
				const resolvedValues = createAsync(async () => {
					return {
						spaceUsed: await val().spaceUsed(),
						spaceTotal: await val().spaceTotal(),
					};
				});

				return (
					<Suspense fallback={<LoadingSpinner />}>
						<Show when={resolvedValues()}>
							{(val) => {
								const percentageUsed = (
									(val().spaceUsed / val().spaceTotal) *
									100
								).toFixed(2);

								return (
									<div
										// When the parent button is hover over, the radial bar will change color to still be legible
										class="radial-progress text-secondary mt-0.5 group-hover:text-secondary-content"
										style={`--value:${percentageUsed};`}
										aria-valuenow={percentageUsed}
										role="progressbar"
									>
										{percentageUsed}%
									</div>
								);
							}}
						</Show>
					</Suspense>
				);
			}}
		</Show>
	);
}
