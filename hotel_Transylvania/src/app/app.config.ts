import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withPreloading, withEnabledBlockingInitialNavigation } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { SelectivePreloadStrategy } from './strategies/selective-preload.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Provide the strategy implementation so the router can inject it when
    // `withPreloading(SelectivePreloadStrategy)` is used.
    SelectivePreloadStrategy,
    // Provide router with selective optimizations: enable blocking initial navigation
    // (faster initial render) and use a selective preloading strategy so only
    // explicitly marked routes are fetched in the background after initial load.
    provideRouter(routes, withEnabledBlockingInitialNavigation(), withPreloading(SelectivePreloadStrategy)),
    provideAnimations(),
  ],
};
