interface Model {
	id: string | number;
	[key: string]: any;
}

interface Patch<T> {
	removes: T[];
	inserts: T[];
	moves: Array<{ item: T; to: number }>;
}

/**
* Reconciles two arrays of keyed models using
* O(n) keyed diff + LIS for minimal moves.
*/
export function reconcile<T extends Model>(
	oldArr: T[],
	newArr: T[]
): Patch<T> {
	const newIndexMap = new Map<string | number, number>();
	newArr.forEach((item, i) => newIndexMap.set(item.id, i));
	
	const removes: T[] = [];
	const inserts: T[] = [];
	const moves: Array<{ item: T; to: number }> = [];
	
	// Step 1: Determine which old items remain
	const posSeq: number[] = [];
	const oldItemsStillPresent: T[] = [];
	
	for (const oldItem of oldArr) {
		const newIndex = newIndexMap.get(oldItem.id);
		if (newIndex == null) {
			removes.push(oldItem);
		} else {
			posSeq.push(newIndex);
			oldItemsStillPresent.push(oldItem);
		}
	}
	
	// Step 2: Compute LIS on positions
	const lis = longestIncreasingSubsequence(posSeq);
	
	const lisSet = new Set(lis);
	
	// Step 3: Identify moves (not in LIS)
	let pos = 0;
	for (let i = 0; i < oldItemsStillPresent.length; i++) {
		if (!lisSet.has(i)) {
			const item = oldItemsStillPresent[i];
			const newIndex = posSeq[i];
			moves.push({ item, to: newIndex });
		}
	}
	
	// Step 4: Find inserts (items not in old array)
	const oldIds = new Set(oldArr.map((x) => x.id));
	for (let i = 0; i < newArr.length; i++) {
		if (!oldIds.has(newArr[i].id)) {
			inserts.push(newArr[i]);
		}
	}
	
	return { removes, inserts, moves };
}

/**
* Classic O(n log n) LIS algorithm
*/
function longestIncreasingSubsequence(arr: number[]): number[] {
	const p = arr.slice();
	const result: number[] = [];
	let u: number, v: number;
	
	if (arr.length === 0) return result;
	
	result.push(0);
	
	for (let i = 1; i < arr.length; i++) {
		if (arr[i] > arr[result[result.length - 1]]) {
			p[i] = result[result.length - 1];
			result.push(i);
			continue;
		}
		
		u = 0;
		v = result.length - 1;
		
		while (u < v) {
			const c = ((u + v) / 2) | 0;
			if (arr[result[c]] < arr[i]) u = c + 1;
			else v = c;
		}
		
		if (arr[i] < arr[result[u]]) {
			if (u > 0) p[i] = result[u - 1];
			result[u] = i;
		}
	}
	
	u = result.length;
	v = result[u - 1];
	
	while (u-- > 0) {
		result[u] = v;
		v = p[v];
	}
	
	return result;
}


// export function reconcileSimple<T extends Model>(
// 	oldArr: T[],
// 	newArr: T[]
// ): Patch<T> {

// 	let indexA = 0;
// 	let indexB = Math.max(newArr.length, oldArr.length) - 1;
// 	let stoppedA = false, stoppedB = false;
// 	// 1 1
// 	// 2 2
// 	// 3 3
// 	// 4
// 	for (; indexA < indexB; indexA++, indexB--) {
// 		const oldElemA = oldArr[indexA];
// 		const oldElemB = oldArr[indexB];
// 		const newElemA = oldArr[indexA];
// 		const newElemB = oldArr[indexB];
// 		if (oldElemA.id !== newElemA.id) stoppedA = true;
// 		if (oldElemB.id !== newElemB.id) stoppedB = true;


// 	}

// }


/**
 * Compares two arrays and returns the elements that were added and removed.
 * 
 * Example usage:
```
const oldArray = [1, 2, 3, 4];
const newArray = [3, 4, 5, 6];

const result = compareArrays(oldArray, newArray);
console.log(result); // { added: [5, 6], removed: [1, 2] }
```
 */
export function compareArrays<T>(oldArray: T[], newArray: T[]): { added: T[], removed: T[] } {
    const oldSet = new Set(oldArray);
    const newSet = new Set(newArray);

    const added = newArray.filter(item => !oldSet.has(item));
    const removed = oldArray.filter(item => !newSet.has(item));

    return { added, removed };
}

/**
 * Compares two arrays of objects by a key and returns the elements that were added, removed, and the same.
 * @param oldArray 
 * @param newArray 
 * @param idKey name of the key to compare objects by
 * @returns 
 */
export function compareArraysById<T>(oldArray: T[], newArray: T[], idKey: keyof T): { added: T[], removed: T[], changed: T[] } {
    // TODO: refactor to make it more performant
    const oldIds = new Map(oldArray.map(item => [item[idKey], item]));
    const newIds = new Set(newArray.map(item => item[idKey]));

	const changed: T[] = [];
	const removed: T[] = oldArray.filter(item => !newIds.has(item[idKey]));
    const added: T[] = [];
	for (let index = 0; index < newArray.length; index++) {
		const item = newArray[index];
		if (oldIds.has(item[idKey])) {
			// console.log(oldIds.get(item[idKey]))
			if (item !== oldIds.get(item[idKey])) {
				changed.push(item);
			}
		} else {
			added.push(item);
		}
	}
    // const removed = oldArray.filter((item) => {
    //     if (newIds.has(item[idKey])) {
    //         const newItem = newArray.find(newItem => newItem[idKey] === item[idKey]);
    //         if (newItem) {
    //             same.push(newItem);
    //         }
    //         return false;
    //     }
    //     return true;
    // });

    return { added, removed, changed };
}
