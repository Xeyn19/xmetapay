import { redirect } from "next/navigation";

export default function ParentPage() {
  redirect("/parent/dashboard");
}

