import { FlashToast } from "@/app/_components/flash-toast";
import { consumeAuthFlashToast, getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { AuthForm, PortalAuthLayout } from "../../_components/auth-ui";

export default async function ParentLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ signedOut?: string }>;
}) {
  const { signedOut } = await searchParams;
  const session = await getSession();

  if (session?.role === "parent") {
    redirect("/parent/dashboard");
  }

  const toast = signedOut === "1"
    ? {
        role: "parent" as const,
        title: "Signed out",
        description: "You have signed out of the parent portal.",
      }
    : await consumeAuthFlashToast("parent");

  return (
    <PortalAuthLayout portal="parent" mode="login">
      <FlashToast toast={toast} />
      <AuthForm
        portal="parent"
        mode="login"
        title="Sign in to parent portal"
        subtitle="Open your family dashboard to view linked students, fees, and allowance wallets."
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
