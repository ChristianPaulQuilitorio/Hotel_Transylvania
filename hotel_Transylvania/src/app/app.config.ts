import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules, withEnabledBlockingInitialNavigation } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Provide router with selective optimizations: enable blocking initial navigation (faster initial render)
    // and use a preloading strategy so lazy routes are fetched in the background after initial load.
    provideRouter(routes, withEnabledBlockingInitialNavigation(), withPreloading(PreloadAllModules)),
  ],
};
