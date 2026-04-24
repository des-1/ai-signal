import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Signal — Industry Intelligence",
  description: "AI news digests for media, law, finance and more — RepresentAI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
