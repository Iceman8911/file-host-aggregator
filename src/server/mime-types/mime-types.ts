"use server";
import { extension, lookup } from "mime-types";

const gMimeTypeServerFunctions = {
	lookup,
	extension,
};

export default gMimeTypeServerFunctions;
