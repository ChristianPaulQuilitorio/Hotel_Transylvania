# HotelTransylvania

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.15.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Database: Ratings schema

This app can store room ratings (1–5 stars) and optional feedback comments.

Apply the SQL in `supabase/ratings.sql` in your Supabase project:

1. Open Supabase Dashboard → SQL → New query → paste the contents of `supabase/ratings.sql` → Run.
2. This creates `public.ratings` with row-level security:
	- Anyone can read ratings to compute averages
	- Only the rating owner (auth.uid()) can insert/update/delete their own rating
3. The script also adds a `ratings_summary` view and helpful indexes.

Frontend wiring:
- `src/app/services/ratings.service.ts` – read summaries and submit ratings (Supabase first, localStorage fallback)
- `src/app/dashboard/dashboard.component.ts` – show current average stars; allow users to rate + comment
- `src/app/landing/landing.component.ts` – show average stars on featured cards

## Deployment: Vercel

This app is ready to deploy on Vercel as a static Angular site.

Pre-configured: A `vercel.json` file defines the build, output directory, and SPA rewrites.

Quick start (Git import):

1. Push this project to GitHub, GitLab, or Bitbucket.
2. Go to https://vercel.com/new → Import your repository.
3. Framework preset: Angular (detected automatically).
4. Build command: `npm run build` (auto).
5. Output directory: `dist/hotel-transylvania` (auto from `angular.json`).
6. Deploy → your site will be available at `https://<your-project>.vercel.app`.

CLI deploy (optional):

```powershell
npx vercel@latest
npx vercel@latest --prod
```

SPA routing: The `vercel.json` includes a rewrite so deep links (e.g., `/dashboard`) serve `index.html`.

Supabase settings:
- If you use Supabase Email/OAuth auth flows, add your Vercel URL in Supabase Dashboard → Authentication → URL Configuration → Site URL and Redirect URLs.
- The current `src/environments/environment.ts` already embeds the public Supabase URL and anon key. If you prefer to use environment-specific keys, create `environment.prod.ts` and configure file replacements in `angular.json`.
