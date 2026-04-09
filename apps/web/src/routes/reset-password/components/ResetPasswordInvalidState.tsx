import { Link } from "react-router";

import { Button } from "@/components/ui/button";

function ResetPasswordInvalidState() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Button asChild className="rounded-full">
          <Link discover="none" to="/forgot-password">
            Request a new link
          </Link>
        </Button>
        <Button asChild className="rounded-full" variant="outline">
          <Link discover="none" to="/login">
            Back to sign in
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default ResetPasswordInvalidState;
