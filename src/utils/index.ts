/**
 * Utility functions.
 */

/**
 * Generate a UUID v4 string.
 *
 * @param placeholder UUID placeholder.
 * @returns A new UUID.
 */
export const uuid = (placeholder?: number): string => {
	if (
		typeof window !== 'undefined' &&
		typeof window.crypto === 'object' &&
		typeof window.crypto.randomUUID === 'function'
	) {
		return window.crypto.randomUUID();
	}
	// Basic fallback for non-browser environments or older browsers (less robust)
	return placeholder
		? // eslint-disable-next-line no-bitwise
		  (placeholder ^ ((Math.random() * 16) >> (placeholder / 4))).toString(16)
		: (String(1e7) + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: string) => {
				const numC = Number(c);
				// eslint-disable-next-line no-bitwise
				return (numC ^ ((Math.random() * 16) >> (numC / 4))).toString(16);
		  });
};

/**
 * Escapes only unicode characters to support auth signature generation.
 *
 * @param str String to escapte unicode characters in.
 * @returns Escaped string.
 */
export const escapeUnicode = (str: string): string => {
	return str.replace(/[^\0-~]/g, (ch: string) => {
		return '\\u' + ('000' + ch.charCodeAt(0).toString(16)).slice(-4);
	});
};

/**
 * Get a throttled version of a function to reduce event trigger rates.
 *
 * @param delay Milliseconds to delay function call by.
 * @param fn Callback.
 * @returns Throttled function.
 */
export const throttle = <T extends (...args: any[]) => any>(
	delay: number,
	fn: T
): ((...args: Parameters<T>) => ReturnType<T> | void) => {
	let lastCall = 0;
	return function (...args: Parameters<T>): ReturnType<T> | void {
		const now = new Date().getTime();
		if (now - lastCall < delay) {
			return;
		}
		lastCall = now;
		return fn(...args);
	};
};

/**
 * Get browser locale / language.
 *
 * @returns The browser locale code.
 */
export const getLanguage = (): string => {
	if (typeof navigator !== 'undefined') {
		return (navigator.language || (navigator as any).browserLanguage || (navigator.languages || ['en_US'])[0])
			.toLowerCase()
			.replace('-', '_');
	}
	return 'en_US'; // Default for non-browser environments
};

/**
 * Array merge function for deepmerge.
 *
 * @param destinationArray The array to merge into.
 * @param sourceArray The original array.
 * @returns The original array.
 */
export const overwriteMerge = <T>(destinationArray: T[], sourceArray: T[]): T[] => sourceArray;

/**
 * Resolves an attribute or metric value and sanitize it.
 *
 * @param value Property value.
 * @param sanitizeCallback Callback to correct the type.
 * @returns Sanitized value.
 */
const prepareData = async <V, R>(value: V | (() => V | Promise<V>), sanitizeCallback: (val: V) => R): Promise<R> => {
	let resolvedValue: V;
	if (typeof value === 'function') {
		resolvedValue = await (value as () => V | Promise<V>)();
	} else {
		resolvedValue = value;
	}
	return sanitizeCallback(resolvedValue);
};

/**
 * Ensure value is a string or array of strings.
 *
 * @param value Attribute to sanitize.
 * @returns Attribute value as a string or array of strings.
 */
const sanitizeAttribute = (value: unknown): string | string[] => {
	if (Array.isArray(value)) {
		return value.map((val) => escapeUnicode(String(val)));
	}
	return escapeUnicode(String(value));
};

/**
 * Ensure value is a single float.
 *
 * @param value Metric to sanitize.
 * @returns Sanitized metric value.
 */
const sanitizeMetric = (value: unknown): number => {
	const num = Array.isArray(value) ? value[0] : value;
	return parseFloat(Number(num));
};

/**
 * Prepares an object for inclusion in endpoint data or event data.
 *
 * @param attributes Attributes object.
 * @param asArray If true ensure an array of strings is returned for each property.
 * @returns The sanitized attributes.
 */
export const prepareAttributes = async (
	attributes: Record<string, unknown | unknown[]>,
	asArray: boolean = false
): Promise<Record<string, string | string[]>> => {
	const sanitized: Record<string, string | string[]> = {};
	for (const name in attributes) {
		if (Object.prototype.hasOwnProperty.call(attributes, name)) {
			const value = attributes[name];
			if (asArray) {
				// Ensure value is treated as potentially needing to be an array for sanitizeAttribute
				const valueToProcess = Array.isArray(value) ? value : [value];
				sanitized[name] = await prepareData(valueToProcess, sanitizeAttribute);
			} else {
				// Ensure value is treated as a single item for sanitizeAttribute
				const valueToProcess = Array.isArray(value) ? value[0] : value;
				sanitized[name] = await prepareData(valueToProcess, (val) => sanitizeAttribute(val) as string);
			}
		}
	}
	return sanitized;
};

/**
 * Prepares an object for inclusion in endpoint data or event data.
 *
 * @param metrics Metrics object.
 * @returns Sanitized metrics object.
 */
export const prepareMetrics = async (metrics: Record<string, unknown>): Promise<Record<string, number>> => {
	const sanitized: Record<string, number> = {};
	for (const name in metrics) {
		if (Object.prototype.hasOwnProperty.call(metrics, name)) {
			sanitized[name] = await prepareData(metrics[name], sanitizeMetric);
		}
	}
	return sanitized;
};

/**
 * Convert a number into a short string representation eg 3k.
 *
 * @param metric The metric to get a condensed version of.
 * @param suffix The unit or suffix to append.
 * @returns The metric compacted for display.
 */
export const compactMetric = (metric: number, suffix: string = ''): string => {
	if (isNaN(metric)) {
		return '0' + suffix;
	}

	if (!isFinite(metric)) {
		return ''; // Or perhaps '∞' or some other indicator
	}

	let volumeSuffix = '';
	let value: number = metric;
	const positiveMetric = metric < 0 ? metric * -1 : metric;

	if (positiveMetric >= 1000000) {
		volumeSuffix = 'M';
		value = metric / 1000000;
	} else if (positiveMetric >= 1000) {
		volumeSuffix = 'k';
		value = metric / 1000;
	}

	if (value < 10 && value > -10 && value !== Math.round(value)) {
		value = parseFloat(value.toFixed(1));
	} else {
		value = Math.round(value);
	}

	return `${value}${volumeSuffix}${suffix}`;
};

/**
 * Get the percentage change between 2 numbers.
 *
 * @param current Current value.
 * @param previous Previous value.
 * @returns The percentage change between the values.
 */
export const getLift = (current: number, previous: number): number => {
	if (current === 0 && previous === 0) return 0; // Avoid NaN for 0/0
	if (current === 0) return -100; // Or handle as appropriate if previous was non-zero
	return ((current - previous) / (Math.abs(current) || 1)) * 100; // Use Math.abs for denominator if lift can be on negative trends
};

/**
 * Format a number.
 *
 * @param number The number to format.
 * @returns Formatted number.
 */
export const formatNumber = (num: number): string => {
	return new Intl.NumberFormat().format(num);
};

/**
 * Detect if the current request is likely to be a bot.
 *
 * @param userAgent Current user agent string.
 * @returns True if UA is likely to be from a bot.
 */
export const detectRobot = (userAgent: string): boolean => {
	const robots = new RegExp(
		[
			/bot/,
			/spider/,
			/crawl/, // GENERAL TERMS
			/APIs-Google/,
			/AdsBot/,
			/Googlebot/, // GOOGLE ROBOTS
			/mediapartners/,
			/Google Favicon/,
			/FeedFetcher/,
			/Google-Read-Aloud/,
			/DuplexWeb-Google/,
			/googleweblight/,
			/bing/,
			/yandex/,
			/baidu/,
			/duckduck/,
			/yahoo/, // OTHER ENGINES
			/ecosia/,
			/ia_archiver/,
			/facebook/,
			/instagram/,
			/pinterest/,
			/reddit/, // SOCIAL MEDIA
			/slack/,
			/twitter/,
			/whatsapp/,
			/youtube/,
			/semrush/, // OTHER
		]
			.map((r) => r.source)
			.join('|'),
		'i'
	);

	return robots.test(userAgent);
};

/**
 * Get a letter of the alphabet corresponding to an array index.
 *
 * @param index Index of alphabet to return letter from.
 * @returns A letter of the alphabet.
 */
export const getLetter = (index: number): string => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.max(0, Math.min(index, 25))]; // Corrected length to 25

/**
 * Get a formatted date string.
 * Note: This function uses 'moment'. Ensure 'moment' is installed and imported if not globally available.
 * e.g., import moment from 'moment';
 *
 * @param date JavaScript date object or a string parsable by moment.
 * @returns Formatted date string.
 */
export const getDateString = (date: Date | string): string => {
	// Assuming moment is available (either globally or imported)
	// If using moment, you'd typically import it: import moment from 'moment';
	// For this conversion, we'll assume a global moment or it's handled by the project setup.
	if (typeof (window as any).moment === 'function') {
		return (window as any).moment(date).format('MMMM D, YYYY — HH:mm');
	}
	// Fallback if moment is not available
	const d = new Date(date);
	return `${d.toLocaleString('default', { month: 'long' })} ${d.getDate()}, ${d.getFullYear()} — ${String(
		d.getHours()
	).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Get a duration string.
 *
 * @param elapsed Elapsed time in milliseconds.
 * @returns The duration string.
 */
export const getDurationString = (elapsed: number): string => {
	const days = Math.floor(elapsed / (24 * 60 * 60 * 1000));
	const hours = Math.floor((elapsed % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
	const minutes = Math.floor((elapsed % (60 * 60 * 1000)) / (60 * 1000));
	return `${days}d ${hours}h ${minutes}m`;
};

/**
 * Compare two arrays for equality (shallow comparison).
 *
 * @param array1 First array.
 * @param array2 Array to compare with.
 * @returns True if the arrays are equivalent.
 */
export const arrayEquals = <T>(array1: T[], array2: T[]): boolean =>
	array1.length === array2.length && array1.every((value, index) => value === array2[index]);

/**
 * Updates an array element given its index.
 *
 * @param arr Elements array.
 * @param value The updated element string.
 * @param index The array index of the element to update.
 * @returns The updated array.
 */
export const replaceElement = <T>(arr: readonly T[] = [], value: T, index: number = 0): T[] => {
	const newArray = [...arr];
	if (index >= 0 && index < newArray.length) {
		newArray[index] = value;
	} else if (index === newArray.length) {
		// Allow appending if index is at the end
		newArray.push(value);
	}
	// Or throw error for out of bounds index if preferred
	return newArray;
};

/**
 * Remove an array element.
 *
 * @param arr Elements array.
 * @param index The index of the element to remove.
 * @returns The updated array.
 */
export const removeElement = <T>(arr: readonly T[], index: number): T[] => {
	const newArray = [...arr];
	if (index >= 0 && index < newArray.length) {
		newArray.splice(index, 1);
	}
	// Or throw error for out of bounds index if preferred
	return newArray;
};
