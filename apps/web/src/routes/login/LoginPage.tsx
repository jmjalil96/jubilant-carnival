import { useNavigate } from "react-router";

import AuthLayout from "@/routes/auth/AuthLayout";
import AuthRouteGate from "@/routes/auth/AuthRouteGate";
import LoginForm from "@/routes/login/components/LoginForm";
import { useLoginForm } from "@/routes/login/hooks/useLoginForm";

function LoginPage() {
  const navigate = useNavigate();
  const loginForm = useLoginForm({
    onSuccess: () => {
      void navigate("/", { replace: true });
    },
  });

  return (
    <AuthRouteGate>
      <AuthLayout
        description="Use your tenant credentials to access the web client."
        eyebrow="Account Access"
        title="Sign in"
      >
        <LoginForm {...loginForm} />
      </AuthLayout>
    </AuthRouteGate>
  );
}

export default LoginPage;
