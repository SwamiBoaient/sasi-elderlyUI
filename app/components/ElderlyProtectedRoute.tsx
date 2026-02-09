"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useElderlyAuth } from "../contexts/ElderlyAuthContext";

export default function ElderlyProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, token } = useElderlyAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated || !token) {
      console.log(
        "[ELDERLY PROTECTED] Not authenticated, redirecting to login",
      );
      // router.push("/");
    }
  }, [isAuthenticated, token, router]);

  // if (!isAuthenticated || !token) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
  //       <div className="text-center">
  //         <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
  //         <p className="text-gray-600 font-inter">Verifying...</p>
  //       </div>
  //     </div>
  //   );
  // }

  return <>{children}</>;
}
