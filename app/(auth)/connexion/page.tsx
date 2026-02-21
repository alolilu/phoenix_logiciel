import { Suspense } from "react";
import ConnexionClient from "./ConnexionClient";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ConnexionClient />
    </Suspense>
  );
}