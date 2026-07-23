import { PasswordResetPage } from "@/app/_components/password-reset-page";

export default function ParentForgotPasswordPage() {
  return (
    <PasswordResetPage
      role="parent"
      portalLabel="Parent or guardian account"
      loginHref="/parent/login"
    />
  );
}
