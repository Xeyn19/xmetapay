import { AuthForm, PortalAuthLayout } from "../../_components/auth-ui";

export default function ParentRegisterPage() {
  return (
    <PortalAuthLayout portal="parent" mode="register">
      <AuthForm
        portal="parent"
        mode="register"
        title="Create parent account"
        subtitle="Link your guardian profile to an existing student record from the school."
        fields={[
          {
            label: "Guardian name",
            name: "guardianName",
            placeholder: "Maria Santos",
          },
          {
            label: "Email",
            name: "email",
            type: "email",
            placeholder: "parent@email.com",
          },
          {
            label: "Phone number",
            name: "phone",
            type: "tel",
            placeholder: "0917 000 0000",
          },
          {
            label: "Student ID or reference",
            name: "studentReference",
            placeholder: "BWA-001",
          },
          {
            label: "Relationship",
            name: "relationship",
            placeholder: "Select relationship",
            options: ["Mother", "Father", "Guardian"],
            spanFull: true,
          },
          {
            label: "Password",
            name: "password",
            type: "password",
            placeholder: "Create a password",
          },
          {
            label: "Confirm password",
            name: "confirmPassword",
            type: "password",
            placeholder: "Re-enter password",
          },
        ]}
      />
    </PortalAuthLayout>
  );
}
