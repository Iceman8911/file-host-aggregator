import { createEffect, type JSX, onCleanup, onMount, Show } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Portal } from "solid-js/web";

/** Applies a custom context menu around the children */
export default function CustomContextMenu(prop: {
	/** Should be a list of items e.g `<li><button>...</button></li> <li><button>...</button></li>` */
	contextMenu: JSX.Element;
	children: JSX.Element;
	/** Whether the context menu should close when a menu item in it is clicked.
	 *
	 * Default's to false
	 */
	closeOnClick?: boolean;
}) {
	const [contextMenuSettings, setContextMenuSettings] = createStore({
		show: false,
		x: 0,
		y: 0,
		normalizedX: 0,
		normalizedY: 0,
	});

	function closeContextMenu() {
		setContextMenuSettings({
			show: false,
			x: 0,
			y: 0,
			normalizedX: 0,
			normalizedY: 0,
		});
	}

	function stopEventPropagation(e: Event) {
		e.stopPropagation();
	}

	onMount(() => {
		// Close the menu when te escape key is pressed
		const listener = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				closeContextMenu();
			}
		};
		const type = "keyup";

		document.addEventListener(type, listener);

		onCleanup(() => {
			document.removeEventListener(type, listener);
		});
	});

	let $contextMenu!: HTMLUListElement;

	/** To make sure that the context menu won't clip out of the screen */
	function normalizePosition(x: number, y: number, element: Element) {
		const rect = element.getBoundingClientRect();
		const maxX = window.innerWidth - rect.width;
		const maxY = window.innerHeight - rect.height;
		if (x > maxX) x = maxX;
		if (y > maxY) y = maxY;

		if (x < 0) x = 0;
		if (y < 0) y = 0;

		return { x, y };
	}

	// Calculate normalized position after the element is rendered
	createEffect(() => {
		if (contextMenuSettings.show && $contextMenu) {
			const { x, y } = normalizePosition(
				contextMenuSettings.x,
				contextMenuSettings.y,
				$contextMenu,
			);
			setContextMenuSettings({ normalizedX: x, normalizedY: y });
		}
	});

	return (
		<>
			{/* Wrapper to open the context menu */}
			<button
				type="button"
				onContextMenu={(e) => {
					e.preventDefault();
					setContextMenuSettings({ show: true, x: e.x, y: e.y });
				}}
			>
				{prop.children}
			</button>

			<Show when={contextMenuSettings.show}>
				<Portal>
					{/* Wrapper to close the context menu when clicked */}
					<button
						aria-label="Close context menu"
						type="button"
						class="w-[100vw] h-[100vh] fixed top-0 left-0"
						onClick={(_) => {
							setContextMenuSettings({ show: false });
						}}
						onContextMenu={(e) => {
							e.preventDefault();
							closeContextMenu();
						}}
					>
						<ul
							aria-label="Context menu"
							class="menu dropdown-content bg-base-100 rounded-box border border-secondary z-1 min-w-fit w-35 p-2 shadow-sm text-secondary text-[0.9rem] [&_svg]:size-5"
							ref={$contextMenu}
							style={{
								position: "fixed",
								top: `${contextMenuSettings.normalizedY ?? contextMenuSettings.y}px`,
								left: `${contextMenuSettings.normalizedX ?? contextMenuSettings.x}px`,
							}}
							onClick={(e) => !prop.closeOnClick && stopEventPropagation(e)}
							onKeyUp={(e) => !prop.closeOnClick && stopEventPropagation(e)}
						>
							{prop.contextMenu}
						</ul>
					</button>
				</Portal>
			</Show>
		</>
	);
}
