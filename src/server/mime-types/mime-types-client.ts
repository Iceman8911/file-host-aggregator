import gMimeTypeServerFunctions from "./mime-types";

const { extension: _extension, lookup: _lookup } = gMimeTypeServerFunctions;

const extension = (...args: Parameters<typeof _extension>) => {
	"use server";
	return _extension(...args);
};

const lookup = (...args: Parameters<typeof _lookup>) => {
	"use server";
	return _lookup(...args);
};

const gMimeTypeClientFunctions = {
	extension,
	lookup,
};

export default gMimeTypeClientFunctions;
