import type { Metadata } from "next";
import "./globals.css";
import { CommunityProvider } from "./components/CommunityProvider";

export const metadata: Metadata = {
  title: "동네식탁 — 우리 동네의 좋은 한 끼",
  description: "가까운 동네 음식점을 찾아보세요.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><CommunityProvider>{children}</CommunityProvider></body></html>;
}
