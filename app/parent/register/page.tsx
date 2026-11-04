import { AuthForm, PortalAuthLayout } from "../../_components/auth-ui";

export default function ParentRegisterPage() {
  return (
    <PortalAuthLayout portal="parent" mode="register">
      <AuthForm
        portal="parent"
        mode="register"
        title="Create parent account"
        subtitle="Enter your child’s official student details. We’ll identify the school securely, then the school will review the connection before sign-in."
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
            label: "Students",
            name: "studentClaims",
            type: "studentClaims",
            placeholder: "BWA-001",
            spanFull: true,
          },
          {
            label: "Official school code",
            name: "schoolCode",
            type: "schoolCodeWhenNeeded",
            placeholder: "Enter the code shown on the school record",
            required: false,
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
      />
    </PortalAuthLayout>
  );
}
