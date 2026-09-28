import { redirect } from "next/navigation";

/** Open sign-up is closed: student accounts are created when someone enrols. */
export default function RegisterPage() {
  redirect("/enroll");
}
