export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-7">
      {eyebrow ? (
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-600">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-950">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
          {description}
        </p>
      ) : null}
    </header>
  );
}
