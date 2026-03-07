import Link from "next/link"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <html>
      <body>

        <nav className="p-4 border-b flex gap-6">

          <Link href="/">
            Home
          </Link>

          <Link href="/figures">
            Figures
          </Link>

        </nav>

        {children}

      </body>
    </html>
  )
}