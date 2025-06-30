import type { FilePath, FilePathWithExtension } from "~/declarations/types";

abstract class BaseFile {
	dateCreated = new Date();
	dateEdited = new Date();
	parent: FSDirectory | null = null;

	constructor(
		/** E.g Cow.png, Downloads */
		public name: string,
	) {}

	/** E.g /Desktop/Cow.png, /Home/Downloads */
	path(
		/** If `true`, it will iterate through it's parent's until it reaches an instance without a parent, at which it will return the combined path for all of them. */
		useFullPath = false,
	): FilePath | FilePathWithExtension {
		const { parent } = this;
		const basePath: FilePath = `/${this.name}`;

		if (!useFullPath || !parent) return basePath;

		const getPathFromRoot = (
			parent: FSDirectory | null = null,
			currentPath: FilePath = basePath,
		): FilePath => {
			if (!parent) return currentPath;

			return getPathFromRoot(parent.parent, `${parent.path()}${currentPath}`);
		};

		return getPathFromRoot(parent).replace("//", "/") as
			| FilePath
			| FilePathWithExtension;
	}
}

type FileName = `${string}.${string}`;

class FSFile<TContent = unknown> extends BaseFile {
	constructor(
		/** "Cow.png", "Dog.jpg", "Budget.docx" */
		public name: FileName,
		public content: TContent,
	) {
		super(name);
	}

	/** The extension */
	ext() {
		return this.name.match(/\.(.+)$/)?.[1] ?? "";
	}
}

type FSChild = FSFile | FSDirectory;

class FSDirectory extends BaseFile {
	children = new Map<FilePath, FSChild>();

	getChild(pathToChild: FilePath): FSChild | null {
		const getChildRecursive = (
			path: FilePath,
			parentToSearchIn: FSDirectory = this,
		): FSChild | null => {
			const childPathToConfirm = path.match(/^\/[^/]+/)?.[0] as
				| FilePath
				| undefined;
			// This shouldn't happen if the path is structured well
			if (!childPathToConfirm) return null;

			const possibleChild = parentToSearchIn.children.get(childPathToConfirm);

			if (!possibleChild) return null;

			const restOfPath = path.replace(childPathToConfirm, "") as FilePath | "";

			if (possibleChild instanceof FSFile || !restOfPath) return possibleChild;

			return getChildRecursive(restOfPath, possibleChild);
		};

		return getChildRecursive(pathToChild);
	}

	/** Attempts to add the file / directory as it's direct child.
	 *
	 * Does not overwrite data unless explicitly set to do so
	 *
	 * @returns the created child if successful
	 */
	private _addDirectChild<TChild extends FSChild = FSChild>(
		child: TChild,
	): false | TChild;
	private _addDirectChild<TChild extends FSChild = FSChild>(
		child: TChild,
		overwrite: true,
	): TChild;
	private _addDirectChild<TChild extends FSChild = FSChild>(
		child: TChild,
		overwrite?: true,
	): false | TChild {
		const childPath = child.path();
		const possibleExistingChild = this.children.get(childPath);

		if (possibleExistingChild && !overwrite) return false;

		this.children.set(childPath, child);
		child.parent = this;
		return child;
	}

	/** Attempts to add the file / directory as it's descendant child.
	 *
	 * Does not overwrite data unless explicitly set to do so
	 *
	 * @returns the created child if successful
	 */
	private _addDescendantChild<TChild extends FSChild = FSChild>(
		child: TChild,
		path: FilePath,
	): false | TChild;
	private _addDescendantChild<TChild extends FSChild = FSChild>(
		child: TChild,
		path: FilePath,
		overwrite: true,
	): TChild;
	private _addDescendantChild<TChild extends FSChild = FSChild>(
		child: TChild,
		/** Must not end with an extension */
		path: FilePath,
		overwrite?: true,
	): false | TChild {
		const childPath = child.path();
		const fullChildPath: FilePath = `${path}${childPath}`;
		const possibleExistingChild = this.getChild(fullChildPath);

		if (possibleExistingChild && !overwrite) return false;

		const createDirectoriesAndStoreChild = (
			path: FilePath,
			childToStore: FSChild,
			parent: FSDirectory = this,
		): void => {
			if (path === "/") {
				parent._addDirectChild(childToStore);
				return;
			}

			const pathCutOut = path.match(/^\/[^/]+/)?.[0] as FilePath | undefined;

			if (!pathCutOut) return;

			const newParent =
				parent.children.get(pathCutOut) ??
				parent._addDirectChild(
					new FSDirectory(pathCutOut.replace("/", "")),
					true,
				);

			// This should not happen, it's just for typescript to know the type
			if (newParent instanceof FSFile) return;

			const restOfPath = path.replace(pathCutOut, "") as FilePath | "";

			// Just dump the child into the new parent
			if (!restOfPath) {
				newParent._addDirectChild(childToStore);
				return;
			}

			createDirectoriesAndStoreChild(restOfPath, childToStore, newParent);
		};

		createDirectoriesAndStoreChild(fullChildPath, child);
		return child;
	}

	addFile<TContent>(
		content: TContent | FSFile<TContent>,
		name: FileName = content instanceof FSFile ? content.name : "file.bin",
		path?: FilePath,
	): FSFile<TContent> | false {
		const file =
			content instanceof FSFile ? content : new FSFile(name, content);
		file.content;
		return path
			? this._addDescendantChild(file, path)
			: this._addDirectChild(file);
	}

	addDir(name: string, path?: FilePath): FSDirectory | false {
		const dir = new FSDirectory(name);
		return path
			? this._addDescendantChild(dir, path)
			: this._addDirectChild(dir);
	}
}
