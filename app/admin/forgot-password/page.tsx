import { PasswordResetPage } from "@/app/_components/password-reset-page";

export default function AdminForgotPasswordPage() {
  return (
    <PasswordResetPage
      role="admin"
      portalLabel="School admin account"
      loginHref="/admin/login"
    />
  );
}
