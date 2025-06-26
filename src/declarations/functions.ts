export const generateUUID = () => crypto.randomUUID();
export const convertToArray = (...args: Parameters<(typeof Array)["from"]>) =>
	Array.from(...args);
