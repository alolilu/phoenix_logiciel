import Providers from "../providers";
import { PhoenixShellLayout } from "@/src/phoenix-ui-shell/PhoenixShellLayout";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <PhoenixShellLayout>{children}</PhoenixShellLayout>
    </Providers>
  );
}
