import "./globals.css"
import Link from "next/link"

export default function RootLayout({children,}: {
  readonly children: React.ReactNode
}) {

  return (
    <html lang="en">
      <body>

        <nav className="p-4 border-b flex gap-6">

          <Link href="/">
            Home
          </Link>

        </nav>

        {children}

      </body>
    </html>
  )
}