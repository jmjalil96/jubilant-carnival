function HomePage() {
  return (
    <section className="space-y-4">
      <p className="text-xs font-semibold tracking-[0.2em] uppercase text-muted-foreground">
        Frontend Starter
      </p>
      <h1 className="max-w-3xl text-4xl leading-tight font-semibold sm:text-5xl">
        `apps/web` is live.
      </h1>
      <p className="max-w-2xl text-base leading-7 text-muted-foreground">
        This frontend starter now includes the shared shell, route-level error
        handling, live system checks, Tailwind v4, shadcn/ui, and integration
        test coverage for the main app boundary.
      </p>
    </section>
  );
}

export default HomePage;
