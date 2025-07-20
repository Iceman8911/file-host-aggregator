import { ReactiveMap } from "@solid-primitives/map";
import QuickLRU, { type Options } from "quick-lru";

/** Reactive LRU wrapper. */
export class ReactiveLRU<TKey, TValue> {
	/** Regular LRU without reactivity */
	private readonly _lru: QuickLRU<TKey, TValue>;

	/** Reactive map that'll reflect changes made to the LRU */
	private readonly _state = new ReactiveMap<TKey, TValue>();

	constructor(options: Omit<Options<TKey, TValue>, "onEviction">) {
		const self = this;

		// Instantiate QuickLRU with eviction callback to sync reactive store
		this._lru = new QuickLRU({
			...options,

			// When QuickLRU evicts an entry, remove it from state
			onEviction(key, _) {
				self._state.delete(key);
			},
		});
	}

	get(key: TKey): TValue | undefined {
		const value = this._state.get(key);

		// So the lru can know the entry has been recently used
		this._lru.get(key);

		return value;
	}

	set(key: TKey, value: TValue, maxAge?: number): this {
		this._lru.set(key, value, { maxAge });

		this._state.set(key, value);

		return this;
	}

	delete(key: TKey): boolean {
		this._lru.delete(key);

		return this._state.delete(key);
	}

	/**
	 * Clears entire cache
	 */
	clear() {
		this._lru.clear();
		this._state.clear();
	}

	has(key: TKey): boolean {
		return this._state.has(key);
	}

	/**
	 * Returns current entries in cache
	 */
	entries() {
		return this._state.entries();
	}

	/**
	 * Returns current cache size
	 */
	size(): number {
		return this._state.size;
	}
}
