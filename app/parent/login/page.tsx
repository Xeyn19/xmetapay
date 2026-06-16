import { AuthForm, PortalAuthLayout } from "../../_components/auth-ui";

export default function ParentLoginPage() {
  return (
    <PortalAuthLayout portal="parent" mode="login">
      <AuthForm
        portal="parent"
        mode="login"
        title="Sign in to parent portal"
        subtitle="Open your family dashboard to review fees, enrollment, and allowance wallets."
        fields={[
          {
            label: "Email or mobile number",
            name: "identifier",
            placeholder: "parent@email.com or 0917 000 0000",
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
