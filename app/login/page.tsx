import { Suspense } from "react";
import Logo from "@/components/Logo";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col px-6 py-10">
      <Logo />
      <div className="flex flex-1 items-center justify-center">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
