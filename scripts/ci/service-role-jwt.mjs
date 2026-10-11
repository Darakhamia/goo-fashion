// CI only: a service-role JWT for the throwaway PostgREST in the migrations job.
// Signed with the job's own secret (JWT_SECRET); worthless anywhere else.
import { createHmac } from "node:crypto";

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("JWT_SECRET is not set");
const part = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const unsigned = `${part({ alg: "HS256", typ: "JWT" })}.${part({ role: "service_role", iss: "ci" })}`;
const signature = createHmac("sha256", secret).update(unsigned).digest("base64url");
process.stdout.write(`${unsigned}.${signature}`);
