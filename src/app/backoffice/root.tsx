"use client";
import { AuthGate } from "@/components/bo/AuthGate";
import { Backoffice } from "@/components/bo/Backoffice";

export function BackofficeRoot() {
  return <div className="bo"><AuthGate><Backoffice /></AuthGate></div>;
}
