import { useLocation } from "@solidjs/router";
import MenuIcon from "lucide-solid/icons/menu";

export default function Nav() {
	const DRAWER_WIDTH = "w-[60vw] sm:w-45 md:w-60";

	const location = useLocation();
	const active = (path: string) =>
		path == location.pathname
			? "border-sky-600"
			: "border-transparent hover:border-sky-600";

	return (
		<nav class={`drawer sm:drawer-open absolute sm:relative ${DRAWER_WIDTH}`}>
			<input id="my-drawer-2" type="checkbox" class="drawer-toggle" />
			<div class="drawer-content flex flex-col items-center justify-center absolute">
				{/* <!-- Page content here --> */}
				<label
					for="my-drawer-2"
					class="btn btn-primary drawer-button rounded-l-none p-2 sm:hidden"
				>
					<MenuIcon aria-description="Show Drawer Icon" />
				</label>
			</div>
			<div class="drawer-side">
				<label
					for="my-drawer-2"
					aria-label="close sidebar"
					class="drawer-overlay"
				></label>
				<ul
					class={`menu bg-base-200 text-base-content min-h-full ${DRAWER_WIDTH} p-4 text-xl font-bold`}
				>
					<li>
						<a href="/">Files</a>
					</li>
					<li>
						<a href="/about">Favourites</a>
					</li>
				</ul>
			</div>
		</nav>
	);
}
