import { AuthForm, PortalAuthLayout } from "../../_components/auth-ui";

export default function AdminLoginPage() {
  return (
    <PortalAuthLayout portal="admin" mode="login">
      <AuthForm
        portal="admin"
        mode="login"
        title="Sign in to admin"
        subtitle="Use your school-issued account to open the admin operations dashboard."
        fields={[
          {
            label: "Work email",
            name: "email",
            type: "email",
            placeholder: "admin@school.edu.ph",
          },
          {
            label: "Password",
            name: "password",
            type: "password",
            placeholder: "Enter your password",
          },
        ]}
      />
    </PortalAuthLayout>
  );
}
