import { FlashToast } from "@/app/_components/flash-toast";
import { consumeAuthFlashToast } from "@/lib/auth/session";
import { AuthForm, PortalAuthLayout } from "../../_components/auth-ui";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ signedOut?: string }>;
}) {
  const { signedOut } = await searchParams;
  const toast = signedOut === "1"
    ? {
        role: "admin" as const,
        title: "Signed out",
        description: "You have signed out of the school admin dashboard.",
      }
    : await consumeAuthFlashToast("admin");

  return (
    <PortalAuthLayout portal="admin" mode="login">
      <FlashToast toast={toast} />
      <AuthForm
        portal="admin"
        mode="login"
        title="Sign in to admin"
        subtitle="Use your school-issued account to open the admin operations dashboard."
        fields={[
          {
            label: "Email or phone",
            name: "email",
            placeholder: "admin@school.edu.ph or 0917 000 0000",
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
