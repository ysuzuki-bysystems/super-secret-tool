export const metadata = {
  title: 'SUPER SECRET SYSTEM.',
  description: 'SUPER SECRET SYSTEM.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
