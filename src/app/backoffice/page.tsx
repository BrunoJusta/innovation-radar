import type { Metadata } from "next";
import "./bo.css";
import { BackofficeRoot } from "./root";

export const metadata: Metadata = { title: "Backoffice · Radar de Inovação", robots: { index: false, follow: false } };

export default function Page() { return <BackofficeRoot />; }
