import { Outlet } from "react-router";

import AppShell from "@/routes/root/AppShell";

function RootLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export default RootLayout;
