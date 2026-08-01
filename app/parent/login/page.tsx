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
        eventId: "parent-signed-out",
      }
    : await consumeAuthFlashToast("parent");

  return (
    <PortalAuthLayout portal="parent" mode="login">
      <FlashToast toast={toast} />
      <AuthForm
        portal="parent"
        mode="login"
        title="Parent sign in"
        subtitle="Access your family payment dashboard."
        fields={[
          {
            label: "Email or mobile number",
            name: "identifier",
            placeholder: "Enter your email or mobile number",
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
