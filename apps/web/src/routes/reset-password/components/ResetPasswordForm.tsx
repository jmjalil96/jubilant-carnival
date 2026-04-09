import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UseResetPasswordFormResult } from "@/routes/reset-password/hooks/useResetPasswordForm";

function ResetPasswordForm({
  form,
  onSubmit,
  isPending,
  submitError,
}: UseResetPasswordFormResult) {
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
          <AlertTitle>Reset failed</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="reset-password-password">New password</Label>
        <Input
          aria-invalid={errors.password === undefined ? undefined : true}
          autoComplete="new-password"
          autoFocus
          disabled={isPending}
          id="reset-password-password"
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
        {isPending ? "Resetting password..." : "Reset password"}
      </Button>
    </form>
  );
}

export default ResetPasswordForm;
