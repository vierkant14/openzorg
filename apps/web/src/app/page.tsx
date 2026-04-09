import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <main className="text-center max-w-2xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-brand-800 mb-4">OpenZorg</h1>
        <p className="text-lg text-gray-600 mb-8">
          Open source modulair zorgplatform voor Nederlandse zorginstellingen
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="bg-brand-600 text-white px-6 py-3 rounded-lg hover:bg-brand-700 transition-colors"
          >
            Inloggen
          </Link>
          <Link
            href="/dashboard"
            className="border border-brand-600 text-brand-600 px-6 py-3 rounded-lg hover:bg-brand-50 transition-colors"
          >
            Dashboard
          </Link>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-4 text-left">
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-brand-700">ECD</h3>
            <p className="text-sm text-gray-500">Elektronisch Cliëntendossier</p>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-brand-700">Planning</h3>
            <p className="text-sm text-gray-500">Roostering en dagplanning</p>
          </div>
        </div>
      </main>
    </div>
  );
}
