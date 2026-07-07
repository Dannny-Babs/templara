import type { Route } from './+types/home';
import TemplaraLanding from '@/components/templara-landing';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Templara — Build documents from data, visually.' },
    {
      name: 'description',
      content:
        'A browser-first document builder and rendering engine. Design templates on a canvas, bind elements to JSON, render consistent PDFs, PNGs, and browser previews.',
    },
  ];
}

export default function Home() {
  return <TemplaraLanding />;
}
