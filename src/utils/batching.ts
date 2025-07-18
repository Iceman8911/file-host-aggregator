/** Batches elements from an iterable into arrays of a specified size.
 * @param iterable - The iterable to batch elements from
 * @param batchSize - The maximum number of elements per batch (default: 5)
 * @yields Arrays containing batched elements from the input iterable
 */
export function* batchIterable<TIterableElement>(
	iterable: Iterable<TIterableElement>,
	batchSize = 10,
): Generator<ReadonlyArray<TIterableElement>, void, unknown> {
	const batch: TIterableElement[] = [];

	for (const item of iterable) {
		batch.push(item);

		if (batch.length === batchSize) {
			yield batch;

			batch.length = 0;
		}
	}

	if (batch.length > 0) {
		yield batch;
	}
}

export function* combineIterators<TIterableElement>(
	iteralbleElements: ReadonlyArray<TIterableElement>,
	iterators: ReadonlyArray<IteratorObject<TIterableElement>>,
): Generator<TIterableElement> {
	for (const ele of iteralbleElements) {
		yield ele;
	}

	for (const iterator of iterators) {
		yield* iterator;
	}
}
