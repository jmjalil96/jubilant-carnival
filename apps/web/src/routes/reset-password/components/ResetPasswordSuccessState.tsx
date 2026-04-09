import { Link } from "react-router";

import { Button } from "@/components/ui/button";

function ResetPasswordSuccessState() {
  return (
    <div className="space-y-6">
      <Button asChild className="rounded-full">
        <Link discover="none" to="/login">
          Back to sign in
        </Link>
      </Button>
    </div>
  );
}

export default ResetPasswordSuccessState;
