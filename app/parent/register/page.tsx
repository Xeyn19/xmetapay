import { AuthForm, PortalAuthLayout } from "../../_components/auth-ui";

export default function ParentRegisterPage() {
  return (
    <PortalAuthLayout portal="parent" mode="register">
      <AuthForm
        portal="parent"
        mode="register"
        title="Create parent account"
        subtitle="Connect your account to your student records."
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
