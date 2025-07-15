import ArchiveFileIcon from "lucide-solid/icons/file-archive";
import AudioFileIcon from "lucide-solid/icons/file-audio";
import ImageFileIcon from "lucide-solid/icons/file-image";
import UnknownFileIcon from "lucide-solid/icons/file-question-mark";
import TextFileIcon from "lucide-solid/icons/file-text";
import DocumentFileIcon from "lucide-solid/icons/file-type";
import VideoFileIcon from "lucide-solid/icons/file-video";
import DefaultFolderIcon from "lucide-solid/icons/folder";
import HardDriveIcon from "lucide-solid/icons/hard-drive";
import { Match, Switch } from "solid-js";
import { Dynamic } from "solid-js/web";
import { FileHost } from "~/classes/file-host";
import { FileHostFile } from "~/classes/file-host-file";
import { FILE_TYPE } from "~/shared/enums";
import { gFileHostIcons } from "~/shared/file-host-icons";
import type { FileOrDirectoryOrFileHost } from "~/types/file-directory-file-host/file-directory-file-host";

export function FileView_Thumbnail(prop: { data: FileOrDirectoryOrFileHost }) {
	return (
		<Switch>
			<Match when={prop.data instanceof FileHost && prop.data}>
				{(val) => (
					<>
						<HardDriveIcon />
						<Dynamic
							component={gFileHostIcons[val().type]}
							class="absolute right-0 bottom-0 size-6 opacity-75"
						/>
					</>
				)}
			</Match>

			<Match
				when={
					!(prop.data instanceof FileHost) &&
					!(prop.data instanceof FileHostFile)
				}
			>
				<DefaultFolderIcon />
			</Match>

			<Match when={prop.data instanceof FileHostFile && prop.data}>
				{(file) => (
					<Switch fallback={<UnknownFileIcon />}>
						<Match when={file().metadata.type === FILE_TYPE.ARCHIVE}>
							<ArchiveFileIcon />
						</Match>

						<Match when={file().metadata.type === FILE_TYPE.AUDIO}>
							<AudioFileIcon />
						</Match>

						<Match when={file().metadata.type === FILE_TYPE.DOCUMENT}>
							<DocumentFileIcon />
						</Match>

						<Match when={file().metadata.type === FILE_TYPE.IMAGE}>
							<ImageFileIcon />
						</Match>

						<Match when={file().metadata.type === FILE_TYPE.TEXT}>
							<TextFileIcon />
						</Match>

						<Match when={file().metadata.type === FILE_TYPE.VIDEO}>
							<VideoFileIcon />
						</Match>
					</Switch>
				)}
			</Match>
		</Switch>
	);
}
