import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/lib/toast";
import { LanguageProvider } from "@/lib/i18n";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ToastProvider defaultPosition="top-right" defaultDuration={3000}>
          <Component {...pageProps} />
        </ToastProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
