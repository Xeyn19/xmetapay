import { AuthForm, PortalAuthLayout } from "../../_components/auth-ui";

export default function AdminRegisterPage() {
  return (
    <PortalAuthLayout portal="admin" mode="register">
      <AuthForm
        portal="admin"
        mode="register"
        title="Create admin access"
        subtitle="Create the school owner account for XMETA Pay. Staff accounts can be managed later from the admin workspace."
        fields={[
          {
            label: "Admin name",
            name: "adminName",
            placeholder: "Maria Dela Cruz",
          },
          {
            label: "School name",
            name: "schoolName",
            placeholder: "Brentwood Academy of Las Pinas",
          },
          {
            label: "School email",
            name: "email",
            type: "email",
            placeholder: "admin@school.edu.ph",
          },
          {
            label: "Phone number",
            name: "phone",
            type: "tel",
            placeholder: "0917 000 0000",
            required: false,
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
