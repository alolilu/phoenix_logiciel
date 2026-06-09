// "use client";

// import { useEffect } from "react";
// import { signOut } from "next-auth/react";

// export default function AppSecurityGuard() {
//   useEffect(() => {
//     const originalFetch = window.fetch;

//     window.fetch = async (...args) => {
//       const response = await originalFetch(...args);

//       if (response.status === 401 || response.status === 403) {
//         // évite boucle infinie si déjà en train de logout
//         await signOut({ callbackUrl: "/login" });
//       }

//       return response;
//     };

//     return () => {
//       window.fetch = originalFetch;
//     };
//   }, []);

//   return null;
// }