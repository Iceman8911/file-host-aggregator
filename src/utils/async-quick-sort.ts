// From https://gist.github.com/kimamula/fa34190db624239111bbe0deba72a6ab

/**
 * return the mid value among x, y, and z
 * @param x
 * @param y
 * @param z
 * @param compare
 * @returns {Promise.<*>}
 */
async function getPivot<TElement>(
	x: TElement,
	y: TElement,
	z: TElement,
	compare: (a: TElement, b: TElement) => Promise<number>,
) {
	if ((await compare(x, y)) < 0) {
		if ((await compare(y, z)) < 0) {
			return y;
		} else if ((await compare(z, x)) < 0) {
			return x;
		} else {
			return z;
		}
	} else if ((await compare(y, z)) > 0) {
		return y;
	} else if ((await compare(z, x)) > 0) {
		return x;
	} else {
		return z;
	}
}

/**
 * asynchronous quick sort
 * @param arr array to sort
 * @param compare asynchronous comparing function
 * @param left index where the range of elements to be sorted starts
 * @param right index where the range of elements to be sorted ends
 * @returns {Promise.<*>}
 */
export async function quickSort<TArrayElement>(
	arr: ReadonlyArray<TArrayElement>,
	compare: (a: TArrayElement, b: TArrayElement) => Promise<number>,
	left = 0,
	right = arr.length - 1,
): Promise<ReadonlyArray<TArrayElement>> {
	const arrCopy = [...arr];

	if (left < right) {
		let i = left,
			j = right,
			tmp: TArrayElement;
		const pivot = await getPivot(
			arrCopy[i],
			arrCopy[i + Math.floor((j - i) / 2)],
			arrCopy[j],
			compare,
		);
		while (true) {
			while ((await compare(arrCopy[i], pivot)) < 0) {
				i++;
			}
			while ((await compare(pivot, arrCopy[j])) < 0) {
				j--;
			}
			if (i >= j) {
				break;
			}
			tmp = arrCopy[i];
			arrCopy[i] = arrCopy[j];
			arrCopy[j] = tmp;

			i++;
			j--;
		}
		await quickSort(arrCopy, compare, left, i - 1);
		await quickSort(arrCopy, compare, j + 1, right);
	}
	return arrCopy;
}
