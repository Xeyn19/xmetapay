import { AuthForm, PortalAuthLayout } from "../../_components/auth-ui";

export default function AdminRegisterPage() {
  return (
    <PortalAuthLayout portal="admin" mode="register">
      <AuthForm
        portal="admin"
        mode="register"
        title="Create admin account"
        subtitle="Register your school owner account for approval."
        fields={[
          {
            label: "Admin name",
            name: "adminName",
            placeholder: "Maria Dela Cruz",
          },
          {
            label: "School name",
            name: "schoolName",
            placeholder: "Your school name",
          },
          {
            label: "School email",
            name: "email",
            type: "email",
            placeholder: "Enter your work email",
          },
          {
            label: "Phone number",
            name: "phone",
            type: "tel",
            placeholder: "0917 000 0000",
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
