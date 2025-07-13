export const generateUUID = <
	TReturnType = ReturnType<typeof crypto.randomUUID>,
>() => crypto.randomUUID() as TReturnType;

export function convertDateToLegibleString(date: Date): string {
	return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

export function downloadBlobToDisk(blob: Blob, downloadName: string) {
	const blobUrl = URL.createObjectURL(blob);
	const link = Object.assign(document.createElement("a"), {
		download: downloadName,
		href: blobUrl,
	} satisfies Partial<HTMLAnchorElement>);
	link.click();
	URL.revokeObjectURL(blobUrl);
}
