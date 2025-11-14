import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/lib/toast";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <ToastProvider defaultPosition="top-right" defaultDuration={3000}>
        <Component {...pageProps} />
      </ToastProvider>
    </AuthProvider>
  );
}
