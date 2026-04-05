import Link from "next/link"

const dances = [
  "waltz",
  "tango",
  "viennese",
  "foxtrot",
  "quickstep",
  "cha",
  "samba",
  "rumba",
  "paso",
  "jive"
]

export default function HomePage() {

  return (

    <main className="bg-gray-50 dark:bg-gray-950 flex flex-col items-center p-12">

      <h1 className="text-4xl font-bold mb-4 text-center">
        Ballroom Dance Routine Builder
      </h1>

      <p className=" text-gray-600 mb-12">
        Select a dance style
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-4xl">

        {dances.map((dance) => (

          <Link
            key={dance}
            href={`/${dance}/figures`}
            className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow dark:shadow-lg rounded-xl p-6 text-center text-lg font-semibold hover:shadow-lg dark:hover:shadow-xl hover:scale-105 transition"
          >
            {dance.toUpperCase()}
          </Link>

        ))}

      </div>

    </main>

  )
}