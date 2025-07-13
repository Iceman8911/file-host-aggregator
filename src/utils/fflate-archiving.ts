import { type AsyncZipOptions, type AsyncZippable, strToU8, zip } from "fflate";
import { convertPathToString } from "~/declarations/functions";
import type { AnyFilePath } from "~/declarations/types";

const ALREADY_COMPRESSED_FILE_EXTENSIONS = [
	"zip",
	"gz",
	"png",
	"jpg",
	"jpeg",
	"pdf",
	"doc",
	"docx",
	"ppt",
	"pptx",
	"xls",
	"xlsx",
	"heic",
	"heif",
	"7z",
	"bz2",
	"rar",
	"gif",
	"webp",
	"webm",
	"mp4",
	"mov",
	"mp3",
	"aifc",
];

type FileDataToArchive = Readonly<{
	path: AnyFilePath;
	data: ArrayBuffer | string;
}>;
type FileCollectionToArchive = FileDataToArchive[];

export async function archiveFiles(
	fileCollectionToArchive: FileCollectionToArchive,
) {
	const emptyArchive: AsyncZippable = {};

	const parsedFilesToArchive: AsyncZippable = fileCollectionToArchive.reduce(
		(acc, { data, path }) => {
			const pathString = convertPathToString(path);

			const extension = pathString.slice(pathString.lastIndexOf(".") + 1);

			acc[pathString] = [
				typeof data === "string" ? strToU8(data) : new Uint8Array(data),
				{
					level: ALREADY_COMPRESSED_FILE_EXTENSIONS.includes(extension) ? 0 : 6,
				},
			];

			return acc;
		},
		emptyArchive,
	);

	const zipResult = await zipPromise(parsedFilesToArchive, { consume: true });

	return new File([zipResult], "archive.zip");
}

/** Smol wrapper */
function zipPromise(
	arg: Parameters<typeof zip>[0],
	options: AsyncZipOptions = {},
): Promise<Uint8Array<ArrayBufferLike>> {
	return new Promise((resolve, reject) => {
		zip(arg, options, (err, res) => (err ? reject(err) : resolve(res)));
	});
}
