import { A } from "@solidjs/router";
import type { LucideProps } from "lucide-solid";
import FilesIcon from "lucide-solid/icons/file-stack";
import HouseIcon from "lucide-solid/icons/house";
import MenuIcon from "lucide-solid/icons/menu";
import SettingsIcon from "lucide-solid/icons/settings";
// import FavouritesIcon from "lucide-solid/icons/star";
import { For, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";

export default function Nav() {
	const DRAWER_WIDTH = "w-[60vw] sm:w-45 md:w-60";
	const ROUTE_LINKS = [
		{ icon: HouseIcon, name: "Home", route: "/" },
		{ icon: FilesIcon, name: "Files", route: "/files" },
		// { icon: FavouritesIcon, name: "Favourites", route: "/favourites" },
		{ icon: SettingsIcon, name: "Settings", route: "/settings" },
	] as const satisfies ReadonlyArray<{
		route: string;
		name: string;
		icon: (props: LucideProps) => JSX.Element;
	}>;

	return (
		<nav class={`drawer md:drawer-open absolute md:relative ${DRAWER_WIDTH}`}>
			<input id="my-drawer-2" type="checkbox" class="drawer-toggle" />
			<div class="drawer-content flex flex-col items-center justify-center absolute">
				{/* <!-- Page content here --> */}
				<label
					for="my-drawer-2"
					class="btn btn-primary btn-soft btn-sm drawer-button rounded-l-none px-1 md:hidden"
				>
					<MenuIcon aria-label="drawer icon" />
				</label>
			</div>
			<div class="drawer-side">
				<label
					for="my-drawer-2"
					aria-label="close sidebar"
					class="drawer-overlay"
				></label>
				<ul
					class={`menu bg-base-200 text-base-content min-h-full ${DRAWER_WIDTH} py-4 px-2 text-xl font-bold`}
				>
					<For each={ROUTE_LINKS}>
						{({ icon, name, route }) => (
							<li class="my-1">
								<A href={route} activeClass="menu-active" end>
									<Dynamic component={icon} />
									{name}
								</A>
							</li>
						)}
					</For>
				</ul>
			</div>
		</nav>
	);
}
