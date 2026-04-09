import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UseForgotPasswordFormResult } from "@/routes/forgot-password/hooks/useForgotPasswordForm";

function ForgotPasswordForm({
  form,
  onSubmit,
  isPending,
  submitError,
}: UseForgotPasswordFormResult) {
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
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="forgot-password-email">Email</Label>
        <Input
          aria-invalid={errors.email === undefined ? undefined : true}
          autoComplete="email"
          autoFocus
          disabled={isPending}
          id="forgot-password-email"
          placeholder="name@example.com"
          type="email"
          {...register("email")}
        />
        {errors.email?.message === undefined ? null : (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>
      <Button
        className="w-full justify-center rounded-3xl"
        disabled={isPending}
        size="lg"
        type="submit"
      >
        {isPending ? "Sending reset link..." : "Send reset link"}
      </Button>
    </form>
  );
}

export default ForgotPasswordForm;
