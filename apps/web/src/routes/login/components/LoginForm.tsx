import { Link } from "react-router";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UseLoginFormResult } from "@/routes/login/hooks/useLoginForm";

function LoginForm({
  form,
  onSubmit,
  isPending,
  submitError,
}: UseLoginFormResult) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(event) => {
        onSubmit(event);
      }}
    >
      {submitError === null ? null : (
        <Alert
          className="border-destructive/40 bg-destructive/5"
          variant="destructive"
        >
          <AlertTitle>Sign in failed</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          aria-invalid={errors.email === undefined ? undefined : true}
          autoComplete="email"
          autoFocus
          disabled={isPending}
          id="login-email"
          placeholder="name@example.com"
          type="email"
          {...register("email")}
        />
        {errors.email?.message === undefined ? null : (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="login-password">Password</Label>
          <Button
            asChild
            className="h-auto p-0 text-sm font-medium"
            variant="link"
          >
            <Link discover="none" to="/forgot-password">
              Forgot password?
            </Link>
          </Button>
        </div>
        <Input
          aria-invalid={errors.password === undefined ? undefined : true}
          autoComplete="current-password"
          disabled={isPending}
          id="login-password"
          type="password"
          {...register("password")}
        />
        {errors.password?.message === undefined ? null : (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>
      <Button
        className="w-full justify-center rounded-3xl"
        disabled={isPending}
        size="lg"
        type="submit"
      >
        {isPending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}

export default LoginForm;
