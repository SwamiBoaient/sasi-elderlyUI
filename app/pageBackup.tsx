"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useElderlyAuth } from "./contexts/ElderlyAuthContext";
import Notification from "./components/Notification";

// Helper function to decode JWT (without verification - client-side only)
interface JWTPayload {
  elderly_userid?: number;
  admin_id?: number;
  caregiver_assigned?: string;
  session_id?: string;
  exp?: number;
  iat?: number;
  last_activity?: number;
}

function decodeJWT(token: string): JWTPayload | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload) as JWTPayload;
  } catch (error) {
    console.error("Failed to decode JWT:", error);
    return null;
  }
}

// Check if token is expired (client-side check only)
function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) return true;

  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}

export default function ElderlyLoginPage() {
  const [showWelcomeCard, setShowWelcomeCard] = useState(false);
  const [step, setStep] = useState<"start" | "phone" | "face">("start");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Strongly-typed elderly details to avoid `any` lint errors
  interface ElderlyDetails {
    userid: string;
    preferred_name?: string;
    admin_id?: string;
    caregiver_assigned?: string;
    phone_number?: string;
    // add other optional fields returned by the backend if needed
  }

  const [elderlyDetails, setElderlyDetails] = useState<ElderlyDetails | null>(
    null,
  );
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [faceVerificationFailures, setFaceVerificationFailures] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { login, token, isAuthenticated } = useElderlyAuth();
  const router = useRouter();

  // Redirect to chat if already authenticated
  useEffect(() => {
    if (isAuthenticated && token && !isTokenExpired(token)) {
      router.push("/chat");
    }
  }, [isAuthenticated, token, router]);

  // API base URL state (load from /url.json, fallback to env/local)
  const [apiUrl, setApiUrl] = useState<string>(() => {
    try {
      return process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    fetch("/url.json")
      .then((res) => res.json())
      .then((data) => {
        if (data.public_url) setApiUrl(data.public_url);
      })
      .catch((err) => {
        console.error("Failed to load API URL, using localhost:", err);
      });
  }, []);

  // Cleanup camera stream
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleStart = async () => {
    setError("");
    setShowWelcomeCard(true);

    // Check if any token exists in localStorage (expired or not)
    const storedToken = localStorage.getItem("elderlyToken");

    if (storedToken) {
      // Token exists - decode it to get userid
      const payload = decodeJWT(storedToken);

      if (payload && payload.elderly_userid) {
        // Skip phone input, go directly to face verification
        // Fetch elderly details using the userid from token
        setIsLoading(true);

        try {
          const base =
            apiUrl ||
            process.env.NEXT_PUBLIC_API_BASE_URL ||
            "https://maria-subsidizable-maximina.ngrok-free.dev";
          const response = await fetch(`${base}/getelderlydetails`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ elderlyUserid: payload.elderly_userid }),
          });

          const result = await response.json();

          // Handle both response shapes
          const elderlyBody =
            result?.elderly ??
            (result?.elderlyUserid
              ? {
                  userid: String(result.elderlyUserid),
                  preferred_name:
                    result.preferredName ?? result.preferred_name ?? "",
                  admin_id: result.adminId ?? result.admin_id,
                  caregiver_assigned:
                    result.caregiverAssigned ?? result.caregiver_assigned,
                }
              : null);

          if (elderlyBody) {
            setElderlyDetails(elderlyBody);
            // Reset failure counter when starting face verification
            setFaceVerificationFailures(0);
            setStep("face");
            setTimeout(() => startCamera(), 300);
          } else {
            setError(
              "Failed to load elderly details. Please try with phone number.",
            );
            setStep("phone");
          }
        } catch (err) {
          console.error("Failed to fetch elderly details from token:", err);
          setError("Failed to load details. Please try with phone number.");
          setStep("phone");
        } finally {
          setIsLoading(false);
        }
      } else {
        // Token invalid, go to phone input
        setStep("phone");
      }
    } else {
      // No token exists, go to phone input
      setStep("phone");
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    setFaceVerificationFailures(0);
    setStep("face");

    // try {
    //   const base =
    //     apiUrl ||
    //     process.env.NEXT_PUBLIC_API_BASE_URL ||
    //     "http://localhost:5000";
    //   const response = await fetch(`${base}/getelderlydetails`, {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //     },
    //     body: JSON.stringify({ phoneNumber }),
    //   });

    //   const result = await response.json();

    //   // Backend may return different shapes. Support both:
    //   // - { success: true, elderly: { ... } }
    //   // - { elderlyUserid, fullName, adminId, caregiverAssigned, userIdDisplay }
    //   // - or other legacy shapes. We'll detect presence of elderly data and
    //   // proceed to the face step when found.
    //   const elderlyBody =
    //     result?.elderly ??
    //     (result?.elderlyUserid
    //       ? {
    //           userid: String(result.elderlyUserid),
    //           preferred_name:
    //             result.preferredName ?? result.preferred_name ?? "",
    //           admin_id: result.adminId ?? result.admin_id,
    //           caregiver_assigned:
    //             result.caregiverAssigned ?? result.caregiver_assigned,
    //           phone_number: phoneNumber,
    //         }
    //       : null);

    //   if (result.success || elderlyBody) {
    //     if (elderlyBody) {
    //       setElderlyDetails(elderlyBody);
    //     } else if (result.elderly) {
    //       setElderlyDetails(result.elderly);
    //     }
    //     // Reset failure counter when starting face verification
    //     setFaceVerificationFailures(0);
    //     setStep("face");
    //     // Start camera after a brief delay
    //     setTimeout(() => startCamera(), 300);
    //   } else {
    //     setError(result.message || "Phone number not found");
    //   }
    // } catch (err: unknown) {
    //   console.error("Phone lookup error:", err);
    //   setError("Failed to verify phone number");
    // } finally {
    //   setIsLoading(false);
    // }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsCapturing(true);
    } catch (err: unknown) {
      console.error("Camera error:", err);
      setError("Failed to access camera. Please allow camera permissions.");
    }
  };

  const captureAndVerify = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !elderlyDetails) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Draw video frame to canvas
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas context not available");
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to base64
      const base64Image = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];

      // Verify face with backend
      const base =
        apiUrl ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://localhost:5000";
      const response = await fetch(`${base}/verify_elderly_face`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Backend expects 'image' and 'elderlyUserid' (elderlyUserid should be numeric)
          elderlyUserid: Number(elderlyDetails.userid),
          image: base64Image,
        }),
      });

      const result = await response.json();

      if (result.success && result.token) {
        // Reset failure counter on success
        setFaceVerificationFailures(0);

        // Stop camera
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        // Login (use safe fallbacks for optional fields)
        login(result.token, {
          elderly_userid: elderlyDetails.userid,
          preferred_name: elderlyDetails.preferred_name ?? "",
          admin_id: elderlyDetails.admin_id ?? "",
          caregiver_assigned: elderlyDetails.caregiver_assigned ?? "",
        });

        // Navigate to chat
        router.push("/chat");
      } else {
        // Increment failure counter
        setFaceVerificationFailures((prev) => prev + 1);
        setError(result.message || "Face verification failed");
      }
    } catch (err: unknown) {
      console.error("Verification error:", err);
      setError("Failed to verify face. Please try again.");
      // Increment failure counter on error
      setFaceVerificationFailures((prev) => prev + 1);
    } finally {
      setIsLoading(false);
    }
  }, [elderlyDetails, login, router, apiUrl]);

  const handleBack = () => {
    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);

    // Reset failure counter when navigating away
    setFaceVerificationFailures(0);

    // If we have elderlyDetails from token decode, go back to start
    // Otherwise go back to phone input
    if (elderlyDetails && !phoneNumber) {
      setStep("start");
      setShowWelcomeCard(false);
    } else {
      setStep("phone");
    }

    setElderlyDetails(null);
    setPhoneNumber("");
    setError("");
  };

  const handleEnterNumber = () => {
    // Delete token from localStorage
    localStorage.removeItem("elderlyToken");

    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);

    // Reset failure counter
    setFaceVerificationFailures(0);

    // Navigate to phone input step
    setStep("phone");
    setElderlyDetails(null);
    setPhoneNumber("");
    setError("");
  };

  return (
    <div
      className={`relative flex min-h-screen items-center justify-center px-4 ${
        showWelcomeCard ? "pt-0" : "pt-160 lg:pt-0"
      } ${!showWelcomeCard ? "home-bg stretched" : ""}`}
      style={
        showWelcomeCard
          ? {
              backgroundImage:
                "url('/bg1.png'), linear-gradient(to bottom right, #eff6ff, #eef2ff)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {/* Dark overlay for better contrast - only show with welcome card */}
      {showWelcomeCard && (
        <div className="absolute inset-0 bg-black/70" aria-hidden="true" />
      )}

      {/* Landing screen with logo and JOIN button */}
      {!showWelcomeCard && (
        <div className="relative z-10 w-full max-w-sm p-6 bg-transparent rounded-2xl lg:absolute lg:left-[75%] lg:-translate-x-1/2 lg:top-1/2 lg:-translate-y-1/2">
          <div className="space-y-2 lg:flex lg:flex-col items-center">
            <Image
              src="/logomain.svg"
              alt="LifeEase logo"
              width={300}
              height={300}
              className="hidden lg:inline-block"
              priority
            />

            {/* Desktop: Show JOIN button styled as green button */}
            <button
              onClick={handleStart}
              disabled={isLoading}
              className="hidden lg:inline-block py-3 px-8 text-white font-semibold rounded-xl transition bg-green-600 hover:bg-green-700 active:bg-green-800 duration-200 text-lg cursor-pointer disabled:opacity-50"
            >
              {isLoading ? "Loading..." : "JOIN"}
            </button>

            {/* Mobile: Show JOIN as full-width button */}
            <div className="w-full flex flex-col items-stretch lg:hidden">
              <button
                onClick={handleStart}
                disabled={isLoading}
                className="w-full py-4 px-4 text-white font-semibold rounded-xl transition bg-green-600 hover:bg-green-700 active:bg-green-800 duration-200 text-lg cursor-pointer disabled:opacity-50"
              >
                {isLoading ? "Loading..." : "JOIN"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Welcome card - shown after clicking JOIN */}
      {showWelcomeCard && (
        <div className="relative z-10 bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          {/* Logo/Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">WELCOME!</h1>
          </div>

          {step === "start" ? (
            /* START Button Screen */
            <div className="space-y-6 text-center">
              <p className="text-gray-600 text-lg mb-6">
                Press the button below to begin
              </p>

              {error && (
                <Notification message={error} warning={true} className="mb-4" />
              )}

              <button
                type="button"
                onClick={handleStart}
                disabled={isLoading}
                className="w-full bg-green-600 text-white py-5 rounded-xl font-bold text-xl hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {isLoading ? "Loading..." : "JOIN"}
              </button>
            </div>
          ) : step === "phone" ? (
            /* Phone Number Step */
            <form
              onSubmit={handlePhoneSubmit}
              className="space-y-6 text-gray-700"
            >
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium mb-2"
                >
                  PHONE NUMBER
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    // allow digits only and restrict to 10 characters
                    const digits = e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 10);
                    setPhoneNumber(digits);
                  }}
                  placeholder="Enter your phone number"
                  className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                  disabled={isLoading}
                  maxLength={10}
                />
              </div>

              {error && (
                <Notification message={error} warning={true} className="mb-2" />
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#8b5dd3] hover:bg-[#3e189f] active:bg-[#2d1075] text-white py-4 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Verifying..." : "Enter"}
              </button>
            </form>
          ) : (
            /* Face Capture Step */
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  Hello, {elderlyDetails?.preferred_name}!
                </h2>
                <p className="text-gray-600 text-sm">
                  Please look at the camera for face verification
                </p>
              </div>

              {/* Camera View */}
              <div className="relative bg-gray-900 rounded-2xl overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Overlay guide */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-4 border-white rounded-full opacity-30"></div>
                </div>
              </div>

              {/* Hidden canvas for capture */}
              <canvas ref={canvasRef} className="hidden" />

              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={
                    faceVerificationFailures >= 5
                      ? handleEnterNumber
                      : handleBack
                  }
                  disabled={isLoading}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all disabled:opacity-50"
                >
                  {faceVerificationFailures >= 5 ? "Enter Number" : "Back"}
                </button>

                <button
                  type="button"
                  onClick={captureAndVerify}
                  disabled={isLoading || !isCapturing}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Verifying..." : "Verify Face"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
