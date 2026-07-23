import { PasswordResetPage } from "@/app/_components/password-reset-page";

export default function CompanyForgotPasswordPage() {
  return (
    <PasswordResetPage
      role="super_admin"
      portalLabel="Company account"
      loginHref="/login"
    />
  );
}
