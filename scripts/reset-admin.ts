import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { closeDb, createDb } from "../src/db/client";
import { users } from "../src/db/schema";
import { passwordProblem } from "../src/lib/password";

/** Usage: npm run admin:reset -- you@example.com "new long password" */
async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) throw new Error('Usage: npm run admin:reset -- you@example.com "new long password"');
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  const db = await createDb();
  const [user] = await db.update(users).set({ passwordHash: await bcrypt.hash(password, 12), role: "admin", active: true }).where(eq(users.email, email.toLowerCase())).returning();
  await closeDb(db);
  console.log(user ? `Password reset for ${user.email} (admin).` : `No user found with email ${email}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
