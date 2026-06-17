import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
export const metadata: Metadata = { title: "Manzil — Own your home on Arc", description: "Chain-abstracted USDC payments on Arc via Circle App Kit" };
const fontStack = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body style={{ fontFamily: fontStack }} className="bg-gray-950 text-white antialiased min-h-screen"><Providers>{children}</Providers></body></html>;
}
