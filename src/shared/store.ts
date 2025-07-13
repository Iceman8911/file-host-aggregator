import { createStore } from "solid-js/store";

type Settings = {
	/** Determines whether the serialized copies of downloaded file data is compressed to save space.
	 *
	 * When this setting is toggled, **all files are immediately saved and compressed / not compressed**
	 */
	compressOnSave: boolean;
};

const defaultSettings: Readonly<Settings> = {
	compressOnSave: false,
};

export const [gSETTINGS, gSetSettings] = createStore<Settings>(defaultSettings);
