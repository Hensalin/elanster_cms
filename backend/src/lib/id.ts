import { randomBytes } from "node:crypto";
/** Short random id (24 hex chars). */
export const createId = () => randomBytes(12).toString("hex");
