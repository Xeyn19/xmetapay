import { connection } from "next/server";

import { AuthForm, PortalAuthLayout } from "../../_components/auth-ui";
import { getActiveParentRegistrationSchools } from "@/lib/parents/school-scope";

export default async function ParentRegisterPage() {
  await connection();
  const schools = await getActiveParentRegistrationSchools().catch(() => []);

  return (
    <PortalAuthLayout portal="parent" mode="register">
      {schools.length > 0 ? <AuthForm
        portal="parent"
        mode="register"
        title="Create parent account"
        subtitle="Choose one school, then connect children registered at that school."
        fields={[
          {
            label: "School",
            name: "schoolId",
            placeholder: "Select your school",
            options: schools,
            spanFull: true,
          },
          {
            label: "Guardian name",
            name: "guardianName",
            placeholder: "Maria Santos",
          },
          {
            label: "Email",
            name: "email",
            type: "email",
            placeholder: "Enter your email address",
          },
          {
            label: "Phone number",
            name: "phone",
            type: "tel",
            placeholder: "0917 000 0000",
          },
          {
            label: "Relationship",
            name: "relationship",
            placeholder: "Select relationship",
            options: ["Mother", "Father", "Guardian"],
          },
          {
            label: "Student ID or reference",
            name: "studentReferences",
            type: "studentReferences",
            placeholder: "BWA-001",
            spanFull: true,
          },
          {
            label: "Password",
            name: "password",
            type: "password",
            placeholder: "Create a secure password",
          },
          {
            label: "Confirm password",
            name: "confirmPassword",
            type: "password",
            placeholder: "Confirm your password",
          },
        ]}
      /> : (
        <div className="text-center">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#e64a19]">Family access</p>
          <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-[var(--public-text)]">Parent registration unavailable</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[var(--public-muted)]">
            No active schools are accepting parent registrations yet. Ask your school administrator to complete school setup.
          </p>
        </div>
      )}
    </PortalAuthLayout>
  );
}
