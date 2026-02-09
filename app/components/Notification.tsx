"use client";

import React from "react";

type NotificationProps = {
  message: string | null | undefined;
  warning?: boolean; // true = red, false = green
  className?: string;
  role?: string;
};

export default function Notification({ message, warning = true, className = "", role = "status" }: NotificationProps) {
  if (!message) return null;

  const borderClass = warning ? "border-red-200" : "border-green-200";
  const bgClass = warning ? "bg-red-50" : "bg-green-50";
  const textClass = warning ? "text-red-700" : "text-green-800";

  const icon = warning ? (
    // warning/exclamation icon
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M9.001 3.5c.346-.69 1.34-.69 1.686 0l6.5 12.98A1 1 0 0 1 16.687 18H3.314a1 1 0 0 1-.5-1.54L9.001 3.5z" fill="currentColor" opacity="0.12"/>
      <path d="M10 6.5v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="10" cy="14" r="0.8" fill="currentColor" />
    </svg>
  ) : (
    // check/tick icon
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M16.667 5.833L8.75 13.75 5.417 10.417" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <div
      role={role}
      aria-live={warning ? "assertive" : "polite"}
      className={`flex items-start gap-3 p-2 rounded-md border ${borderClass} ${bgClass} ${className}`.trim()}
    >
      <span className={`${textClass} flex-shrink-0`} aria-hidden>
        {icon}
      </span>
      <div className={`text-sm ${textClass}`}>{message}</div>
    </div>
  );
}
