import type { Route } from './+types/home';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { Link } from 'react-router';
import { baseOptions } from '@/lib/layout.shared';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Templara' },
    {
      name: 'description',
      content:
        'A browser-native document runtime and visual authoring platform for structured business documents.',
    },
  ];
}

export default function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-fd-muted-foreground">
          Document runtime &amp; visual authoring
        </p>
        <h1 className="mb-4 text-4xl font-bold tracking-tight">Templara</h1>
        <p className="mx-auto mb-8 max-w-xl text-lg text-fd-muted-foreground">
          Design structured business documents once, bind them to JSON data, and render deterministic
          previews, PDFs, and exports.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            className="rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground"
            to="/docs"
          >
            Read the docs
          </Link>
          <a
            className="rounded-lg border px-4 py-2 text-sm font-medium"
            href="https://github.com/Dannny-Babs/templara"
            target="_blank"
            rel="noreferrer"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </HomeLayout>
  );
}
