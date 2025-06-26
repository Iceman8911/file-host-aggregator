export const generateUUID = <
	TReturnType = ReturnType<typeof crypto.randomUUID>,
>() => crypto.randomUUID() as TReturnType;
export const convertToArray = (...args: Parameters<(typeof Array)["from"]>) =>
	Array.from(...args);
