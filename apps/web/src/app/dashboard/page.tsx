export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-brand-800 text-white px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <h1 className="text-xl font-bold">OpenZorg</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-brand-200">Demo Gebruiker</span>
            <a href="/login" className="text-sm underline hover:text-brand-100">
              Uitloggen
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <DashboardCard
            title="ECD"
            description="Elektronisch Cliëntendossier"
            count={0}
            label="Cliënten"
            href="/ecd"
          />
          <DashboardCard
            title="Planning"
            description="Roostering en dagplanning"
            count={0}
            label="Afspraken vandaag"
            href="/planning"
          />
          <DashboardCard
            title="Taken"
            description="Openstaande werkbak-items"
            count={0}
            label="Openstaand"
            href="/taken"
          />
        </div>

        <div className="mt-8 p-6 bg-white rounded-lg border">
          <h3 className="font-semibold text-gray-700 mb-2">Sprint 1 Status</h3>
          <p className="text-sm text-gray-500">
            Fundament is actief. Multi-tenancy en authenticatie zijn geconfigureerd.
            De FHIR-database is gereed voor gebruik.
          </p>
        </div>
      </main>
    </div>
  );
}

function DashboardCard({
  title,
  description,
  count,
  label,
  href,
}: {
  title: string;
  description: string;
  count: number;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="block p-6 bg-white rounded-lg border hover:shadow-md transition-shadow"
    >
      <h3 className="text-lg font-semibold text-brand-700">{title}</h3>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-brand-800">{count}</span>
        <span className="text-sm text-gray-400">{label}</span>
      </div>
    </a>
  );
}
