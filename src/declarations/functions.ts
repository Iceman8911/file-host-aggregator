export const generateUUID = <
	TReturnType = ReturnType<typeof crypto.randomUUID>,
>() => crypto.randomUUID() as TReturnType;
