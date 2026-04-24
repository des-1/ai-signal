import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Signal — Media & Marketing Digest",
  description: "Weekly AI news digest for media and marketing professionals",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
